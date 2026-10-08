import type { FastifyInstance } from "fastify";
import { eq, and, desc, count, type SQL } from "drizzle-orm";
import { isSupportedChain } from "../chains.js";
import { resolveToken } from "../tokens.js";
import { ownedByCaller, requireApiKey } from "../auth/apiKey.js";
import { db } from "../db/index.js";
import { apiKeys, quotes, customers, intents } from "../db/schema.js";
import { computeFee } from "../fees.js";
import type { UpstreamQuote } from "../providers/types.js";
import { quoteProvider } from "../providers/index.js";
import { NoLiquidityError } from "../providers/arcSwap.js";
import {
  quoteBodySchema,
  quoteResponseSchema,
  quoteListQuerySchema,
  quoteListResponseSchema,
  errorResponseSchema,
  type QuoteBody,
  toJsonSchema,
} from "../schemas.js";

export async function quoteRoutes(app: FastifyInstance) {
  app.post(
    "/v1/quotes",
    {
      onRequest: requireApiKey,
      config: { publishable: true },
      schema: {
        tags: ["quotes"],
        summary: "Create a quote",
        description:
          "Resolves tokenIn/tokenOut on their chains (symbol like WETH/USDC or a real ERC-20 address from GET /v1/tokens), applies the partner fee (api_keys.fee_bps) to the full amountIn, and requests the upstream quote on the net amount. With QUOTE_PROVIDER=arc, prices come live from the Circle Swap solver (no liquidity -> HTTP 400 with the solver's reason). Optional customerId attributes the transaction to a registered end customer for the /v1/ledger revenue report. Accepts a secret key or a publishable key (pk_live_, from one of its allowed Origins), so the browser widget can quote directly.",
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

  app.get(
    "/v1/quotes",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["quotes"],
        summary: "List quotes",
        description:
          "Lists quotes created with any of this partner's API keys (secret or publishable, including rotated-out keys), newest first, each with its submitted intent (if any). Filter with ?customerId=; paginate with ?limit=&offset=. Intent status is the last stored value; poll GET /v1/intents/:id for a live refresh.",
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(quoteListQuerySchema),
        response: {
          200: toJsonSchema(quoteListResponseSchema),
          400: toJsonSchema(errorResponseSchema),
          401: toJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const parsed = quoteListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid input" });
      }
      const { limit, offset, customerId } = parsed.data;
      const key = request.apiKey!;

      const filters: SQL[] = [ownedByCaller(quotes.apiKeyId, key)];
      if (customerId) filters.push(eq(quotes.customerId, customerId));
      const where = and(...filters);

      const [rows, [{ total }]] = await Promise.all([
        db
          .select({ quote: quotes, intentId: intents.id, intentStatus: intents.status })
          .from(quotes)
          .leftJoin(intents, eq(intents.quoteId, quotes.id))
          .where(where)
          .orderBy(desc(quotes.createdAt), desc(quotes.id))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(quotes).where(where),
      ]);

      return reply.send({
        items: rows.map(({ quote, intentId, intentStatus }) => {
          const req = quote.request as unknown as QuoteBody;
          const res = quote.response as unknown as UpstreamQuote | null;
          return {
            quoteId: quote.id,
            customerId: quote.customerId,
            originChainId: req.originChainId,
            destChainId: req.destChainId,
            tokenIn: req.tokenIn,
            tokenOut: req.tokenOut,
            recipient: req.recipient,
            amountIn: quote.amountIn,
            feeAmount: quote.feeAmount,
            feeBps: quote.feeBps,
            netAmount: (BigInt(quote.amountIn) - BigInt(quote.feeAmount)).toString(),
            estimatedOut: res?.estimatedOut ?? null,
            minOut: res?.minOut ?? null,
            expiresAt: Math.floor(quote.expiresAt.getTime() / 1000),
            createdAt: quote.createdAt.toISOString(),
            intent: intentId && intentStatus ? { intentId, status: intentStatus } : null,
          };
        }),
        total,
        limit,
        offset,
      });
    }
  );
}
