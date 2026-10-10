import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { and, count, desc, eq } from "drizzle-orm";
import { requireApiKey, type ApiKeyRow } from "../auth/apiKey.js";
import { config } from "../config.js";
import { getChain, isSupportedChain, listChains } from "../chains.js";
import { db } from "../db/index.js";
import { customers, intents, partners, paymentLegs, payments, quotes } from "../db/schema.js";
import { refreshIntent, type IntentRow } from "../intentStatus.js";
import { referencePriceUsd, usdcToCents } from "../pricing.js";
import { APP_KIT_CHAINS, canRouteFrom, NoLiquidityError } from "../providers/arcSwap.js";
import { quoteProvider } from "../providers/index.js";
import type { UpstreamQuote } from "../providers/types.js";
import { errorResponseSchema, toJsonSchema } from "../schemas.js";
import { getTokens, resolveToken } from "../tokens.js";

function toHuman(amount: string, decimals: number): string {
  const raw = BigInt(amount);
  const base = 10n ** BigInt(decimals);
  const frac = (raw % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${raw / base}${frac ? `.${frac}` : ""}`;
}

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address");

const paymentCreateSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "amount must be a USD value like 10 or 10.50")
    .describe("Price in USD, up to 2 decimals. The merchant receives this in USDC on ARC."),
  description: z.string().trim().max(200).optional().describe("Shown to the customer, e.g. \"Pro plan, 1 month\"."),
  reference: z.string().trim().max(100).optional().describe("Your order id; returned with the payment."),
  customerId: z.string().uuid().optional().describe("Attribute the payment to one of your registered customers."),
  expiresInMinutes: z.number().int().min(5).max(1440).optional().describe("Default 30."),
});

const legCreateSchema = z.object({
  originChainId: z.number().int().describe("Chain the customer pays from."),
  tokenIn: z.string().min(1).describe("Symbol or address of the token they pay with."),
  amountIn: z.string().regex(/^\d+$/).describe("Base units of tokenIn."),
  payer: address.describe("The customer's wallet address on the origin chain."),
  slippageBps: z.number().int().min(0).max(300).optional().describe("Default 50 (0.5%)."),
});

const legSubmittedSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "txHash must be a 32-byte 0x hash"),
});

const payoutSchema = z.object({ payoutAddress: address });
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

const err = toJsonSchema(errorResponseSchema);
const TERMINAL = new Set(["EXECUTED_ON_ARC", "FAILED", "REFUNDED"]);

type PaymentRow = typeof payments.$inferSelect;
type LegRow = typeof paymentLegs.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;

/** Payments belong to the business, so any of its keys (secret or publishable) can read them. */
async function loadOwnedPayment(id: string, key: ApiKeyRow): Promise<PaymentRow | null> {
  if (!key.partnerId || !z.string().uuid().safeParse(id).success) return null;
  const [row] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.partnerId, key.partnerId)))
    .limit(1);
  return row ?? null;
}

interface LegView {
  leg: LegRow;
  quote: QuoteRow;
  intent: IntentRow | null;
}

/**
 * Loads legs, refreshes in-flight intents (best effort: a provider outage
 * keeps the stored status), and rolls the payment status up:
 * settled ≥ amount → paid; anything in flight → processing; some settled →
 * partially_paid; past expiry → expired; else open.
 */
async function rollUp(payment: PaymentRow, refresh = true): Promise<{ payment: PaymentRow; legs: LegView[] }> {
  const rows = await db
    .select({ leg: paymentLegs, quote: quotes, intent: intents })
    .from(paymentLegs)
    .innerJoin(quotes, eq(quotes.id, paymentLegs.quoteId))
    .leftJoin(intents, eq(intents.id, paymentLegs.intentId))
    .where(eq(paymentLegs.paymentId, payment.id))
    .orderBy(paymentLegs.createdAt);

  const legs: LegView[] = [];
  for (const r of rows) {
    let intent = r.intent;
    if (refresh && intent && !TERMINAL.has(intent.status)) {
      try {
        intent = await refreshIntent(intent);
      } catch {
        // keep the stored status; the next poll retries
      }
    }
    legs.push({ leg: r.leg, quote: r.quote, intent });
  }

  if (payment.status === "canceled") return { payment, legs };
  const settled = legs.filter((l) => l.intent?.status === "EXECUTED_ON_ARC").reduce((s, l) => s + l.leg.valueCents, 0);
  const inFlight = legs.some((l) => l.intent && !TERMINAL.has(l.intent.status));
  const expired = Date.now() > payment.expiresAt.getTime();
  const status: PaymentRow["status"] =
    settled >= payment.amountCents
      ? "paid"
      : inFlight
        ? "processing"
        : settled > 0
          ? "partially_paid"
          : expired
            ? "expired"
            : "open";

  if (status !== payment.status) {
    const [updated] = await db
      .update(payments)
      .set({ status, updatedAt: new Date(), ...(status === "paid" && !payment.paidAt ? { paidAt: new Date() } : {}) })
      .where(eq(payments.id, payment.id))
      .returning();
    payment = updated;
  }
  return { payment, legs };
}

function legView({ leg, quote, intent }: LegView) {
  const req = quote.request as {
    originChainId: number;
    destChainId: number;
    tokenIn: string;
    recipient: string;
    slippageBps: number;
  };
  const resp = (quote.response ?? {}) as Partial<UpstreamQuote>;
  const token = resolveToken(req.originChainId, req.tokenIn);
  return {
    legId: leg.id,
    quoteId: quote.id,
    originChainId: req.originChainId,
    token: token
      ? { symbol: token.symbol, address: token.address, decimals: token.decimals, isNative: token.isNative }
      : { symbol: req.tokenIn, address: req.tokenIn, decimals: 18, isNative: false },
    amountIn: quote.amountIn,
    estimatedOut: resp.estimatedOut ?? null,
    minOut: resp.minOut ?? null,
    valueCents: leg.valueCents,
    payer: leg.payer,
    expiresAt: Math.floor(quote.expiresAt.getTime() / 1000),
    status: intent?.status ?? "QUOTED",
    originTx: intent?.originTx ?? null,
    destTx: intent?.destTx ?? null,
    /**
     * Everything the customer's wallet needs to run this swap with Circle
     * App Kit (kit.swap): chain aliases, token alias, human amount, recipient.
     */
    execution: {
      fromChain: APP_KIT_CHAINS[req.originChainId] ?? null,
      toChain: APP_KIT_CHAINS[req.destChainId] ?? null,
      tokenIn: token?.isNative ? "NATIVE" : (token?.symbol ?? req.tokenIn),
      tokenOut: "USDC",
      amountIn: toHuman(quote.amountIn, token?.decimals ?? 18),
      recipientAddress: req.recipient,
      slippageBps: req.slippageBps,
    },
  };
}

async function paymentView(payment: PaymentRow, legs: LegView[]) {
  const [partner] = await db.select({ name: partners.name }).from(partners).where(eq(partners.id, payment.partnerId));
  const settled = legs.filter((l) => l.intent?.status === "EXECUTED_ON_ARC").reduce((s, l) => s + l.leg.valueCents, 0);
  const pending = legs
    .filter((l) => l.intent && !TERMINAL.has(l.intent.status))
    .reduce((s, l) => s + l.leg.valueCents, 0);
  return {
    paymentId: payment.id,
    merchantName: partner?.name ?? "",
    amountCents: payment.amountCents,
    currency: payment.currency,
    description: payment.description,
    reference: payment.reference,
    customerId: payment.customerId,
    status: payment.status,
    paidCents: settled,
    pendingCents: pending,
    remainingCents: Math.max(0, payment.amountCents - settled - pending),
    destChainId: payment.destChainId,
    payoutAddress: payment.payoutAddress,
    expiresAt: payment.expiresAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    legs: legs.map(legView),
  };
}

function needPartner(request: FastifyRequest, reply: FastifyReply): (ApiKeyRow & { partnerId: string }) | null {
  const key = request.apiKey!;
  if (!key.partnerId) {
    reply.code(400).send({ error: "api key is not linked to a partner" });
    return null;
  }
  return key as ApiKeyRow & { partnerId: string };
}

/** Which ARC chain payments settle on: the configured one, if it's an ARC chain we know. */
function settlementChainId(): number {
  const configured = getChain(config.arcChainId);
  if (configured?.isArc) return configured.id;
  return listChains().find((c) => c.isArc && !c.testnet)?.id ?? config.arcChainId;
}

export async function paymentRoutes(app: FastifyInstance) {
  app.post(
    "/v1/partners/me/payout",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["payments"],
        summary: "Set the payout address",
        description: "The ARC address that receives checkout payments in USDC. Applies to payments created afterwards.",
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(payoutSchema),
        response: { 200: toJsonSchema(payoutSchema), 400: err, 401: err, 403: err },
      },
    },
    async (request, reply) => {
      const key = needPartner(request, reply);
      if (!key) return reply;
      const parsed = payoutSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "payoutAddress must be a 0x address" });
      const payoutAddress = parsed.data.payoutAddress.toLowerCase();
      await db.update(partners).set({ payoutAddress }).where(eq(partners.id, key.partnerId));
      return reply.send({ payoutAddress });
    }
  );

  app.post(
    "/v1/payments",
    {
      onRequest: requireApiKey,
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["payments"],
        summary: "Create a payment",
        description:
          "Creates a checkout for a USD amount. Hand the paymentId to the checkout widget: the customer pays with any mix of supported tokens from their own wallet, and the USDC settles to your payout address on ARC. Secret keys only.",
        security: [{ bearerAuth: [] }],
        body: { ...toJsonSchema(paymentCreateSchema), example: { amount: "10.00", description: "Pro plan, 1 month", reference: "order_1042" } },
        response: { 201: { type: "object", additionalProperties: true }, 400: err, 401: err, 403: err },
      },
    },
    async (request, reply) => {
      const key = needPartner(request, reply);
      if (!key) return reply;
      const parsed = paymentCreateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      const body = parsed.data;
      const [whole, frac = ""] = body.amount.split(".");
      const amountCents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
      if (amountCents < 50) return reply.code(400).send({ error: "amount must be at least 0.50" });
      if (amountCents > 10_000_000) return reply.code(400).send({ error: "amount must be at most 100000.00" });

      const [partner] = await db.select().from(partners).where(eq(partners.id, key.partnerId)).limit(1);
      if (!partner?.payoutAddress) {
        return reply.code(400).send({ error: "set a payout address first (POST /v1/partners/me/payout or dashboard Settings)" });
      }
      if (body.customerId) {
        const [owned] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.id, body.customerId), eq(customers.partnerId, key.partnerId)))
          .limit(1);
        if (!owned) return reply.code(400).send({ error: "customer not found for this partner" });
      }

      const [payment] = await db
        .insert(payments)
        .values({
          partnerId: key.partnerId,
          apiKeyId: key.id,
          customerId: body.customerId ?? null,
          amountCents,
          description: body.description || null,
          reference: body.reference || null,
          payoutAddress: partner.payoutAddress,
          destChainId: settlementChainId(),
          expiresAt: new Date(Date.now() + (body.expiresInMinutes ?? 30) * 60_000),
        })
        .returning();
      return reply.code(201).send(await paymentView(payment, []));
    }
  );

  app.get(
    "/v1/payments",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["payments"],
        summary: "List payments",
        description: "Payments of the business, newest first, with stored statuses (no upstream refresh).",
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(listQuerySchema),
        response: { 200: { type: "object", additionalProperties: true }, 400: err, 401: err, 403: err },
      },
    },
    async (request, reply) => {
      const key = needPartner(request, reply);
      if (!key) return reply;
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
      const { limit, offset } = parsed.data;
      const where = eq(payments.partnerId, key.partnerId);
      const rows = await db
        .select()
        .from(payments)
        .where(where)
        .orderBy(desc(payments.createdAt), desc(payments.id))
        .limit(limit)
        .offset(offset);
      const [{ total }] = await db.select({ total: count() }).from(payments).where(where);
      const items = [];
      for (const p of rows) items.push(await paymentView(p, (await rollUp(p, false)).legs));
      return reply.send({ items, total, limit, offset });
    }
  );

  app.get(
    "/v1/payments/:id",
    {
      onRequest: requireApiKey,
      config: { publishable: true },
      schema: {
        tags: ["payments"],
        summary: "Payment status",
        description:
          "The payment with its legs. Refreshes in-flight legs from the provider and rolls the status up (open, processing, paid, partially_paid, expired). Accepts the partner's publishable key, so the checkout widget can poll it.",
        security: [{ bearerAuth: [] }],
        response: { 200: { type: "object", additionalProperties: true }, 401: err, 404: err },
      },
    },
    async (request, reply) => {
      const payment = await loadOwnedPayment((request.params as { id: string }).id, request.apiKey!);
      if (!payment) return reply.code(404).send({ error: "payment not found" });
      const { payment: current, legs } = await rollUp(payment);
      return reply.send(await paymentView(current, legs));
    }
  );

  app.post(
    "/v1/payments/:id/legs",
    {
      onRequest: requireApiKey,
      config: { publishable: true, rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["payments"],
        summary: "Quote a payment leg",
        description:
          "Prices one token the customer wants to pay with: tokenIn on originChainId → USDC on ARC, delivered to the payout address. valueCents is what the leg is guaranteed to cover (from minOut). The customer's wallet then executes the swap and reports the transaction hash. Publishable keys allowed.",
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(legCreateSchema),
        response: { 201: { type: "object", additionalProperties: true }, 400: err, 401: err, 404: err, 409: err, 500: err, 502: err },
      },
    },
    async (request, reply) => {
      const key = request.apiKey!;
      const payment = await loadOwnedPayment((request.params as { id: string }).id, key);
      if (!payment) return reply.code(404).send({ error: "payment not found" });
      const parsed = legCreateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      const body = parsed.data;

      const { payment: current } = await rollUp(payment);
      if (current.status === "paid") return reply.code(409).send({ error: "payment is already paid" });
      if (current.status === "canceled") return reply.code(409).send({ error: "payment was canceled" });
      if (Date.now() > current.expiresAt.getTime()) return reply.code(409).send({ error: "payment expired" });

      if (!isSupportedChain(body.originChainId) || getChain(body.originChainId)?.isArc) {
        return reply.code(400).send({ error: "unsupported origin chain" });
      }
      const tokenIn = resolveToken(body.originChainId, body.tokenIn);
      if (!tokenIn) return reply.code(400).send({ error: `token not supported on chain ${body.originChainId}` });
      const usdc = resolveToken(current.destChainId, "USDC");
      if (!usdc) return reply.code(500).send({ error: "settlement token unavailable" });
      if (BigInt(body.amountIn) <= 0n) return reply.code(400).send({ error: "amount must be positive" });

      const slippageBps = body.slippageBps ?? 50;
      const deadline = Math.min(Math.floor(current.expiresAt.getTime() / 1000), Math.floor(Date.now() / 1000) + 15 * 60);
      let upstream: UpstreamQuote;
      try {
        upstream = await quoteProvider.getQuote({
          originChainId: body.originChainId,
          destChainId: current.destChainId,
          tokenIn: tokenIn.address,
          tokenOut: usdc.address,
          amountIn: body.amountIn,
          recipient: current.payoutAddress,
          slippageBps,
          deadline,
        });
      } catch (e) {
        if (e instanceof NoLiquidityError) return reply.code(400).send({ error: e.message });
        return reply.code(502).send({ error: `upstream quote failed: ${String(e)}` });
      }

      const valueCents = usdcToCents(BigInt(upstream.minOut), usdc.decimals);
      const leg = await db.transaction(async (tx) => {
        const [quote] = await tx
          .insert(quotes)
          .values({
            apiKeyId: key.id,
            customerId: current.customerId,
            provider: quoteProvider.name,
            upstreamQuoteId: upstream.id,
            request: {
              originChainId: body.originChainId,
              destChainId: current.destChainId,
              tokenIn: tokenIn.symbol,
              tokenOut: usdc.symbol,
              amountIn: body.amountIn,
              recipient: current.payoutAddress,
              slippageBps,
              deadline,
              paymentId: current.id,
            },
            response: upstream as unknown as Record<string, unknown>,
            amountIn: body.amountIn,
            // Checkout: the merchant receives the full amount; no partner fee on top.
            feeAmount: "0",
            feeBps: 0,
            expiresAt: new Date(deadline * 1000),
          })
          .returning();
        const [row] = await tx
          .insert(paymentLegs)
          .values({ paymentId: current.id, quoteId: quote.id, payer: body.payer.toLowerCase(), valueCents })
          .returning();
        return { leg: row, quote, intent: null };
      });
      return reply.code(201).send(legView(leg));
    }
  );

  app.post(
    "/v1/payments/:id/legs/:legId/submitted",
    {
      onRequest: requireApiKey,
      config: { publishable: true, rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["payments"],
        summary: "Report a leg's transaction",
        description:
          "Called by the checkout after the customer's wallet sends the swap. Starts tracking that origin transaction; the payment is paid once enough legs settle on ARC. Idempotent per leg. A hash that never confirms simply never settles.",
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(legSubmittedSchema),
        response: { 200: { type: "object", additionalProperties: true }, 400: err, 401: err, 404: err, 409: err },
      },
    },
    async (request, reply) => {
      const key = request.apiKey!;
      const { id, legId } = request.params as { id: string; legId: string };
      const payment = await loadOwnedPayment(id, key);
      if (!payment) return reply.code(404).send({ error: "payment not found" });
      const parsed = legSubmittedSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      if (!z.string().uuid().safeParse(legId).success) return reply.code(404).send({ error: "leg not found" });

      const [row] = await db
        .select({ leg: paymentLegs, quote: quotes })
        .from(paymentLegs)
        .innerJoin(quotes, eq(quotes.id, paymentLegs.quoteId))
        .where(and(eq(paymentLegs.id, legId), eq(paymentLegs.paymentId, payment.id)))
        .limit(1);
      if (!row) return reply.code(404).send({ error: "leg not found" });

      const txHash = parsed.data.txHash.toLowerCase();
      if (row.leg.intentId) {
        const [existing] = await db.select().from(intents).where(eq(intents.id, row.leg.intentId)).limit(1);
        if (existing && existing.upstreamId !== txHash) {
          return reply.code(409).send({ error: "this leg already has a different transaction" });
        }
        return reply.send(legView({ leg: row.leg, quote: row.quote, intent: existing ?? null }));
      }
      const reused = await db.select({ id: intents.id }).from(intents).where(eq(intents.upstreamId, txHash)).limit(1);
      if (reused.length > 0) return reply.code(409).send({ error: "transaction already used for another payment" });

      const result = await db.transaction(async (tx) => {
        const [intent] = await tx
          .insert(intents)
          .values({ quoteId: row.quote.id, apiKeyId: key.id, status: "PENDING", upstreamId: txHash, originTx: txHash })
          .returning();
        const [leg] = await tx.update(paymentLegs).set({ intentId: intent.id }).where(eq(paymentLegs.id, row.leg.id)).returning();
        await tx.update(payments).set({ status: "processing", updatedAt: new Date() }).where(eq(payments.id, payment.id));
        return { leg, quote: row.quote, intent };
      });
      return reply.send(legView(result));
    }
  );

  app.get(
    "/v1/prices",
    {
      onRequest: requireApiKey,
      config: { publishable: true },
      schema: {
        tags: ["payments"],
        summary: "Token prices in USD",
        description:
          "Indicative USD price of each token the checkout can pay with, for showing balances in dollars and sizing payment legs. The leg quote is always authoritative. Tokens the swap provider can't route are omitted.",
        security: [{ bearerAuth: [] }],
        response: { 200: { type: "object", additionalProperties: true }, 401: err },
      },
    },
    async (_request, reply) => {
      const live = quoteProvider.name !== "mock";
      const items = listChains()
        .filter((c) => !c.isArc)
        .flatMap((c) =>
          getTokens(c.id).flatMap((t) => {
            const priceUsd = referencePriceUsd(t.symbol);
            if (priceUsd === null || (live && !canRouteFrom(c.id, t))) return [];
            return [{ chainId: c.id, symbol: t.symbol, address: t.address, decimals: t.decimals, isNative: t.isNative, priceUsd }];
          })
        );
      // Reference prices are indicative; every leg is re-priced by a live quote before it's paid.
      return reply.send({ source: "reference", items });
    }
  );
}
