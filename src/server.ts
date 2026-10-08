import Fastify, { type RouteOptions } from "fastify";
import { Redis } from "ioredis";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config.js";
import { CHAINS, isSupportedChain, listChains } from "./chains.js";
import { resolveToken, getTokens } from "./tokens.js";
import { requireApiKey, generateApiKey } from "./auth/apiKey.js";
import { globalRateLimitOptions } from "./auth/rateLimit.js";
import { db, pool } from "./db/index.js";
import { apiKeys, quotes, intents, partners, customers } from "./db/schema.js";
import { computeFee } from "./fees.js";
import type { UpstreamQuote } from "./providers/types.js";
import { quoteProvider } from "./providers/index.js";
import { NoLiquidityError } from "./providers/arcSwap.js";
import {
  quoteBodySchema,
  submitBodySchema,
  intentIdParamsSchema,
  errorResponseSchema,
  healthResponseSchema,
  quoteResponseSchema,
  submitResponseSchema,
  intentResponseSchema,
  chainsResponseSchema,
  tokensResponseSchema,
  partnerCreateSchema,
  partnerResponseSchema,
  customerCreateSchema,
  customerResponseSchema,
  ledgerResponseSchema,
  toJsonSchema,
} from "./schemas.js";

export type App = Awaited<ReturnType<typeof buildApp>>;

interface EndpointInfo {
  method: string;
  path: string;
  auth: boolean;
}

function isAuthRoute(route: RouteOptions): boolean {
  const has = (h: unknown): boolean => {
    const list = Array.isArray(h) ? h : [h];
    return list.includes(requireApiKey as unknown);
  };
  return has(route.onRequest) || has(route.preHandler);
}

export async function buildApp() {
  const app = Fastify({
    logger: config.isTest ? false : { level: config.logLevel },
    ajv: { customOptions: { strict: false } },
  });

  const endpoints: EndpointInfo[] = [];
  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (method === "HEAD" || method === "OPTIONS" || method === "*") continue;
      if (!endpoints.some((e) => e.method === method && e.path === route.url)) {
        endpoints.push({ method, path: route.url, auth: isAuthRoute(route) });
      }
    }
  });

  const redis = new Redis(config.redisUrl);
  app.decorate("redis", redis);
  app.addHook("onClose", async () => {
    redis.disconnect();
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "arc-gateway",
        description:
          "B2B gateway to the ARC network. Businesses self-serve via POST /v1/partners (api key shown once, partner fee charged on amountIn), register their end customers via POST /v1/customers, attribute transactions with customerId, and see revenue in GET /v1/ledger. Partners authenticate with a bearer API key, request cross-chain quotes (a partner fee is charged on amountIn), submit signed intents and poll intent status.\n\nSupported chains: Ethereum (1), Base (8453), Arc (5042), Arc Testnet (5042002) plus BNB (56) / Robinhood (4663) registry entries. Token contracts are real and verified on-chain. Pricing source is pluggable via QUOTE_PROVIDER: \"mock\" (simulated reference prices) or \"arc\" (live Circle Swap solver quotes via App Kit). With \"arc\", swap liquidity exists for Ethereum/Base -> Arc (USDC/EURC destinations).",
        version: "1.0.0",
      },
      servers: [{ url: `http://localhost:${config.port}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", description: "Partner API key (gw_live_...)" },
        },
      },
      tags: [
        { name: "meta", description: "Service discovery, health and auth check" },
        { name: "partners", description: "Business onboarding and API-key creation" },
        { name: "customers", description: "End-customer registry for partner transactions" },
        { name: "quotes", description: "Chain/token discovery and fee-adjusted swap quotes" },
        { name: "intents", description: "Intent submission and status polling" },
        { name: "ledger", description: "Partner revenue and per-customer transaction breakdown" },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(rateLimit, globalRateLimitOptions(redis));

  // ----- meta -----
  app.get(
    "/",
    {
      schema: {
        tags: ["meta"],
        summary: "Endpoint index",
        description: "Machine-readable list of every route on this gateway.",
      },
    },
    async (_request, reply) => {
      return reply.send({
        service: "arc-gateway",
        version: "1.0.0",
        docs: "/docs",
        openapi: "/openapi.json",
        endpoints,
      });
    }
  );

  app.get(
    "/openapi.json",
    { schema: { tags: ["meta"], summary: "OpenAPI document" } },
    async (_request, reply) => reply.send(app.swagger())
  );

  app.get(
    "/health",
    {
      schema: {
        tags: ["meta"],
        summary: "Liveness/readiness",
        response: {
          200: toJsonSchema(healthResponseSchema),
          503: toJsonSchema(healthResponseSchema),
        },
      },
    },
    async (_request, reply) => {
      let dbStatus: "up" | "down" = "down";
      let redisStatus: "up" | "down" = "down";

      try {
        await pool.query("SELECT 1");
        dbStatus = "up";
      } catch {
        dbStatus = "down";
      }

      try {
        redisStatus = (await redis.ping()) === "PONG" ? "up" : "down";
      } catch {
        redisStatus = "down";
      }

      const status = dbStatus === "up" && redisStatus === "up" ? "ok" : "degraded";
      return reply
        .status(status === "ok" ? 200 : 503)
        .send({ status, db: dbStatus, redis: redisStatus });
    }
  );

  app.get(
    "/protected",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["meta"],
        summary: "Auth check",
        description: "Returns 200 if the bearer API key is valid, 401 otherwise.",
        security: [{ bearerAuth: [] }],
        response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } },
      },
    },
    async (_request, reply) => reply.send({ ok: true })
  );

  app.get(
    "/v1/chains",
    {
      schema: {
        tags: ["quotes"],
        summary: "Supported chains",
        description:
          "Real chains the gateway can quote across. Every route's destination is an Arc chain (5042 mainnet or 5042002 testnet). Chain IDs/RPCs/explorers are verified live.",
        response: { 200: toJsonSchema(chainsResponseSchema) },
      },
    },
    async (_request, reply) => {
      return reply.send(listChains());
    }
  );

  app.get(
    "/v1/tokens",
    {
      schema: {
        tags: ["quotes"],
        summary: "Tokens supported per chain",
        description:
          "Real ERC-20 contracts (address + decimals verified on-chain) usable as tokenIn/tokenOut. Filter with ?chainId=; omit to list all.",
        querystring: toJsonSchema(z.object({ chainId: z.coerce.number().int().optional() })),
        response: { 200: toJsonSchema(tokensResponseSchema) },
      },
    },
    async (request, reply) => {
      const { chainId } = request.query as { chainId?: number };
      if (chainId !== undefined) {
        return reply.send(getTokens(chainId));
      }
      const all = Object.keys(CHAINS).map(Number).flatMap(getTokens);
      return reply.send(all);
    }
  );

  // ----- /v1/partners (public onboarding) -----
  app.post(
    "/v1/partners",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        tags: ["partners"],
        summary: "Register a business",
        description:
          "Creates a partner business and returns a new bearer API key (shown once). The key carries the partner's feeBps, charged on every quote the business makes. Idempotent-ish: an email that already exists returns 409. The raw apiKey is only returned in this response — store it securely.",
        body: {
          ...toJsonSchema(partnerCreateSchema),
          example: { partnerName: "Acme Pay", email: "billing@acme.example" },
        },
        response: {
          201: toJsonSchema(partnerResponseSchema),
          400: toJsonSchema(errorResponseSchema),
          409: toJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const parsed = partnerCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid input" });
      }
      const { partnerName, email } = parsed.data;

      if (email) {
        const existing = await db
          .select({ id: partners.id })
          .from(partners)
          .where(eq(partners.email, email))
          .limit(1);
        if (existing.length > 0) {
          return reply.code(409).send({ error: "email already registered" });
        }
      }

      const feeBps = config.partnerDefaultFeeBps;
      const rateLimitPerMin = config.partnerDefaultRateLimitPerMin;

      let partnerId: string;
      try {
        const [partner] = await db
          .insert(partners)
          .values({ name: partnerName, email, feeBps, rateLimitPerMin })
          .returning({ id: partners.id });
        partnerId = partner.id;
      } catch (err) {
        if (String(err).includes("partners_email_unique")) {
          return reply.code(409).send({ error: "email already registered" });
        }
        throw err;
      }

      const key = generateApiKey();
      await db.insert(apiKeys).values({
        partnerId,
        partnerName,
        keyPrefix: key.keyPrefix,
        keyHash: key.keyHash,
        feeBps,
        rateLimitPerMin,
        active: true,
      });

      return reply.code(201).send({
        partnerId,
        apiKey: key.rawKey,
        keyPrefix: key.keyPrefix,
        feeBps,
        rateLimitPerMin,
      });
    }
  );

  // ----- /v1/customers -----
  app.post(
    "/v1/customers",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["customers"],
        summary: "Register an end customer",
        description:
          "Registers one of the partner's end customers (partner's externalId + the recipient address used on destinations). Pass the returned customerId on POST /v1/quotes to attribute transactions and revenue. Re-registering the same externalId is idempotent: returns the existing customer (HTTP 200).",
        security: [{ bearerAuth: [] }],
        body: {
          ...toJsonSchema(customerCreateSchema),
          example: { externalId: "user_1234", recipientAddress: "0x0000000000000000000000000000000000000000" },
        },
        response: {
          200: toJsonSchema(customerResponseSchema),
          201: toJsonSchema(customerResponseSchema),
          400: toJsonSchema(errorResponseSchema),
          401: toJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const parsed = customerCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid input" });
      }
      const key = request.apiKey!;
      if (!key.partnerId) {
        return reply.code(400).send({ error: "api key is not linked to a partner" });
      }

      const { externalId, recipientAddress } = parsed.data;
      const existing = await db
        .select()
        .from(customers)
        .where(
          and(eq(customers.partnerId, key.partnerId), eq(customers.externalId, externalId))
        )
        .limit(1);
      if (existing.length > 0) {
        return reply.send({
          customerId: existing[0].id,
          externalId: existing[0].externalId,
          recipientAddress: existing[0].recipientAddress,
          createdAt: existing[0].createdAt.toISOString(),
        });
      }

      const [customer] = await db
        .insert(customers)
        .values({ partnerId: key.partnerId, externalId, recipientAddress })
        .returning();

      return reply.code(201).send({
        customerId: customer.id,
        externalId: customer.externalId,
        recipientAddress: customer.recipientAddress,
        createdAt: customer.createdAt.toISOString(),
      });
    }
  );

  // ----- /v1/ledger -----
  app.get(
    "/v1/ledger",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["ledger"],
        summary: "Partner revenue ledger",
        description:
          "Sums fees earned (feeBps applied on each quote) for the authenticated business, broken down per customer. Optional ?customerId= filters to a single customer. Requires a key created via POST /v1/partners.",
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(
          z.object({ customerId: z.string().uuid().optional() })
        ),
        response: {
          200: toJsonSchema(ledgerResponseSchema),
          400: toJsonSchema(errorResponseSchema),
          401: toJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const key = request.apiKey!;
      if (!key.partnerId) {
        return reply.code(400).send({ error: "api key is not linked to a partner" });
      }
      const { customerId } = request.query as { customerId?: string };

      let rows = await db
        .select({
          customerId: quotes.customerId,
          amountIn: quotes.amountIn,
          feeAmount: quotes.feeAmount,
        })
        .from(quotes)
        .where(eq(quotes.apiKeyId, key.id));

      if (customerId) {
        const owned = await db
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(eq(customers.id, customerId), eq(customers.partnerId, key.partnerId))
          )
          .limit(1);
        if (owned.length === 0) {
          return reply.code(400).send({ error: "customer not found for this partner" });
        }
        rows = rows.filter((r) => r.customerId === customerId);
      }

      const customerRows = await db
        .select()
        .from(customers)
        .where(eq(customers.partnerId, key.partnerId));
      const customerMap = new Map(customerRows.map((c) => [c.id, c]));

      const grouped = new Map<string, { transactions: number; amountInTotal: bigint; feeTotal: bigint }>();
      let transactions = 0;
      let amountInTotal = 0n;
      let feeTotal = 0n;

      for (const row of rows) {
        const custId = row.customerId ?? null;
        const keyed = custId ?? "__unattributed__";
        const existing = grouped.get(keyed) ?? {
          transactions: 0,
          amountInTotal: 0n,
          feeTotal: 0n,
        };
        existing.transactions += 1;
        existing.amountInTotal += BigInt(row.amountIn);
        existing.feeTotal += BigInt(row.feeAmount);
        grouped.set(keyed, existing);
        transactions += 1;
        amountInTotal += BigInt(row.amountIn);
        feeTotal += BigInt(row.feeAmount);
      }

      const byCustomer = Array.from(grouped.entries()).map(([custId, g]) => {
        const customer = custId === "__unattributed__" ? undefined : customerMap.get(custId);
        return {
          customerId: customer?.id ?? null,
          externalId: customer?.externalId ?? null,
          recipientAddress: customer?.recipientAddress ?? null,
          transactions: g.transactions,
          amountInTotal: g.amountInTotal.toString(),
          feeTotal: g.feeTotal.toString(),
        };
      });

      return reply.send({
        partnerId: key.partnerId,
        customerId: customerId ?? null,
        totals: {
          feeBps: key.feeBps,
          transactions,
          amountInTotal: amountInTotal.toString(),
          feeTotal: feeTotal.toString(),
        },
        byCustomer,
      });
    }
  );

  // ----- /v1/quotes -----
  app.post(
    "/v1/quotes",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["quotes"],
        summary: "Create a quote",
        description:
          "Resolves tokenIn/tokenOut on their chains (symbol like WETH/USDC or a real ERC-20 address from GET /v1/tokens), applies the partner fee (api_keys.fee_bps) to the full amountIn, and requests the upstream quote on the net amount. With QUOTE_PROVIDER=arc, prices come live from the Circle Swap solver (no liquidity -> HTTP 400 with the solver's reason). Optional customerId attributes the transaction to a registered end customer for the /v1/ledger revenue report.",
        security: [{ bearerAuth: [] }],
        body: {
          ...toJsonSchema(quoteBodySchema),
          example: {
            originChainId: 1,
            destChainId: 5042002,
            tokenIn: "WETH",
            tokenOut: "USDC",
            amountIn: "1000000000000000000",
            recipient: "0xRecipientAddress",
            slippageBps: 50,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            customerId: "00000000-0000-0000-0000-000000000000",
          },
        },
        response: {
          200: {
            ...toJsonSchema(quoteResponseSchema),
            example: {
              quoteId: "00000000-0000-0000-0000-000000000000",
              amountIn: "1000000000000000000",
              feeAmount: "1000000000000000",
              feeBps: 10,
              netAmount: "999000000000000000",
              estimatedOut: "929070000000000000",
              minOut: "924424650000000000",
              expiresAt: 1770000000,
              unsignedTx: "0x" + "cd".repeat(32),
            },
          },
          400: toJsonSchema(errorResponseSchema),
          401: toJsonSchema(errorResponseSchema),
          502: toJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const parsed = quoteBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid input" });
      }
      const body = parsed.data;

      const key = request.apiKey!;
      const partner = await db
        .select({ feeBps: apiKeys.feeBps })
        .from(apiKeys)
        .where(eq(apiKeys.id, key.id))
        .limit(1);
      if (partner.length === 0) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const feeBps = partner[0].feeBps;

      if (body.customerId) {
        if (!key.partnerId) {
          return reply.code(400).send({ error: "api key is not linked to a partner" });
        }
        const owned = await db
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(eq(customers.id, body.customerId), eq(customers.partnerId, key.partnerId))
          )
          .limit(1);
        if (owned.length === 0) {
          return reply.code(400).send({ error: "customer not found for this partner" });
        }
      }

      const amountInBig = BigInt(body.amountIn);
      if (amountInBig <= 0n) {
        return reply.code(400).send({ error: "amount must be positive" });
      }
      const { fee, netAmount } = computeFee(amountInBig, feeBps);

      if (!isSupportedChain(body.originChainId) || !isSupportedChain(body.destChainId)) {
        return reply.code(400).send({ error: "unsupported chain" });
      }
      if (body.originChainId === body.destChainId) {
        return reply.code(400).send({ error: "origin and destination must be different chains" });
      }

      const tokenIn = resolveToken(body.originChainId, body.tokenIn);
      if (!tokenIn) {
        return reply.code(400).send({ error: `tokenIn not supported on chain ${body.originChainId}` });
      }
      const tokenOut = resolveToken(body.destChainId, body.tokenOut);
      if (!tokenOut) {
        return reply.code(400).send({ error: `tokenOut not supported on chain ${body.destChainId}` });
      }

      let upstreamQuote: UpstreamQuote;
      try {
        upstreamQuote = await quoteProvider.getQuote({
          originChainId: body.originChainId,
          destChainId: body.destChainId,
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn: netAmount.toString(),
          recipient: body.recipient,
          slippageBps: body.slippageBps,
          deadline: body.deadline,
        });
      } catch (err) {
        if (err instanceof NoLiquidityError) {
          return reply.code(400).send({ error: err.message });
        }
        return reply.code(502).send({ error: `upstream quote failed: ${String(err)}` });
      }

      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const [storedQuote] = await db
        .insert(quotes)
        .values({
          apiKeyId: key.id,
          customerId: body.customerId ?? null,
          provider: quoteProvider.name,
          upstreamQuoteId: upstreamQuote.id,
          request: body as unknown as Record<string, unknown>,
          response: upstreamQuote as unknown as Record<string, unknown>,
          amountIn: body.amountIn,
          feeAmount: fee.toString(),
          feeBps,
          expiresAt: new Date(expiresAt * 1000),
        })
        .returning();

      return reply.send({
        quoteId: storedQuote.id,
        amountIn: storedQuote.amountIn,
        feeAmount: storedQuote.feeAmount,
        feeBps: storedQuote.feeBps,
        netAmount: netAmount.toString(),
        estimatedOut: upstreamQuote.estimatedOut,
        minOut: upstreamQuote.minOut,
        expiresAt,
        unsignedTx: upstreamQuote.unsignedTx,
      });
    }
  );

  // ----- /v1/intents/submit -----
  app.post(
    "/v1/intents/submit",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["intents"],
        summary: "Submit a signed intent",
        description:
          "Idempotent per quoteId: the first call claims the quote and submits upstream, later calls return the existing intent. With QUOTE_PROVIDER=arc this executes the swap: the gateway hot wallet (ARC_SDK_PRIVATE_KEY) approves the origin token and broadcasts the crosschain (CCTP) swap to Arc; listen on GET /v1/intents/:id until status EXECUTED_ON_ARC with a destination tx hash. The partner's signedPayload is currently unused (the gateway wallet signs).",
        security: [{ bearerAuth: [] }],
        body: {
          ...toJsonSchema(submitBodySchema),
          example: { quoteId: "00000000-0000-0000-0000-000000000000", signedPayload: "0x" + "ab".repeat(64) },
        },
        response: {
          200: toJsonSchema(submitResponseSchema),
          400: toJsonSchema(errorResponseSchema),
          401: toJsonSchema(errorResponseSchema),
          500: toJsonSchema(errorResponseSchema),
          502: toJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const parsed = submitBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid input" });
      }
      const { quoteId, signedPayload } = parsed.data;
      const key = request.apiKey!;

      const quote = await db
        .select()
        .from(quotes)
        .where(and(eq(quotes.id, quoteId), eq(quotes.apiKeyId, key.id)))
        .limit(1);
      if (quote.length === 0) {
        return reply.code(400).send({ error: "quote not found or not yours" });
      }

      const quoteExpiresAt = Math.floor(quote[0].expiresAt.getTime() / 1000);
      if (Math.floor(Date.now() / 1000) > quoteExpiresAt) {
        return reply.code(400).send({ error: "quote expired" });
      }

      const intentId = uuidv4();
      const claimed = await db
        .insert(intents)
        .values({
          id: intentId,
          quoteId,
          apiKeyId: key.id,
          status: "PENDING",
          originTx: null,
          destTx: null,
          upstreamId: null,
          error: null,
        })
        .onConflictDoNothing({ target: intents.quoteId })
        .returning();

      if (claimed.length === 0) {
        const existing = await db
          .select({ id: intents.id })
          .from(intents)
          .where(eq(intents.quoteId, quoteId))
          .limit(1);
        if (existing.length === 0) {
          return reply.code(500).send({ error: "intent conflict" });
        }
        return reply.send({ intentId: existing[0].id });
      }

      try {
        const upstreamQuote = (quote[0].response ?? {
          id: quote[0].upstreamQuoteId,
          provider: quote[0].provider,
        }) as unknown as UpstreamQuote;
        const upstreamId = await quoteProvider.submit(upstreamQuote, signedPayload);
        await db
          .update(intents)
          .set({ upstreamId, updatedAt: new Date() })
          .where(eq(intents.id, intentId));
        return reply.send({ intentId });
      } catch (err) {
        await db
          .update(intents)
          .set({ status: "FAILED", error: String(err), updatedAt: new Date() })
          .where(eq(intents.id, intentId));
        return reply.code(502).send({ error: "upstream submit failed" });
      }
    }
  );

  // ----- GET /v1/intents/:id -----
  app.get(
    "/v1/intents/:id",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["intents"],
        summary: "Intent status",
        description: "Polls the upstream provider and persists any status change.",
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(intentIdParamsSchema),
        response: {
          200: toJsonSchema(intentResponseSchema),
          401: toJsonSchema(errorResponseSchema),
          404: toJsonSchema(errorResponseSchema),
          502: toJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const key = request.apiKey!;
      const { id } = request.params as { id: string };

      const intent = await db
        .select()
        .from(intents)
        .where(and(eq(intents.id, id), eq(intents.apiKeyId, key.id)))
        .limit(1);
      if (intent.length === 0) {
        return reply.code(404).send({ error: "not found" });
      }
      const row = intent[0];

      let status = row.status;
      let originTx = row.originTx;
      let destTx = row.destTx;
      if (row.upstreamId) {
        // Load the originating quote so the provider can reconstruct chain/token
        // context for status polling (arc-appkit needs chainIn/chainOut).
        const [quote] = await db
          .select()
          .from(quotes)
          .where(eq(quotes.id, row.quoteId))
          .limit(1);
        const upstreamQuote = quote?.response as unknown as UpstreamQuote | undefined;
        let detail;
        try {
          detail = await quoteProvider.getStatus(row.upstreamId, upstreamQuote);
        } catch {
          return reply.code(502).send({ error: "upstream status unavailable" });
        }
        const updates: Partial<typeof intents.$inferSelect> = {};
        if (detail.status !== row.status) updates.status = detail.status;
        if (detail.originTx && detail.originTx !== row.originTx) updates.originTx = detail.originTx;
        if (detail.destTx && detail.destTx !== row.destTx) updates.destTx = detail.destTx;
        if (Object.keys(updates).length > 0) {
          const [updated] = await db
            .update(intents)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(intents.id, row.id))
            .returning({ status: intents.status, originTx: intents.originTx, destTx: intents.destTx });
          status = updated.status;
          originTx = updated.originTx;
          destTx = updated.destTx;
        }
      }

      return reply.send({
        id: row.id,
        status,
        originTx,
        destTx,
        upstreamId: row.upstreamId,
        error: row.error,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      });
    }
  );

  return app;
}

async function bootstrap() {
  const app = await buildApp();
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`arc-gateway listening on http://localhost:${config.port}`);
  app.log.info(`Swagger UI: http://localhost:${config.port}/docs`);
  app.log.info(`Endpoint index: http://localhost:${config.port}/`);
  console.log(app.printRoutes({ commonPrefix: false }));
}

if (!config.isTest) {
  bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
