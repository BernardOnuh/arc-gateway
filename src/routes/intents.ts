import type { FastifyInstance } from "fastify";
import { eq, and, desc, count, type SQL } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { requireApiKey } from "../auth/apiKey.js";
import { db } from "../db/index.js";
import { quotes, intents } from "../db/schema.js";
import type { UpstreamQuote } from "../providers/types.js";
import { quoteProvider } from "../providers/index.js";
import {
  submitBodySchema,
  submitResponseSchema,
  intentIdParamsSchema,
  intentResponseSchema,
  intentListQuerySchema,
  intentListResponseSchema,
  errorResponseSchema,
  type QuoteBody,
  toJsonSchema,
} from "../schemas.js";

export async function intentRoutes(app: FastifyInstance) {
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

  app.get(
    "/v1/intents",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["intents"],
        summary: "List intents",
        description:
          "Lists intents submitted with this API key, newest first. Filter with ?status= and ?customerId=; paginate with ?limit=&offset=. Returns the last stored status without polling upstream; use GET /v1/intents/:id to refresh a single intent.",
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(intentListQuerySchema),
        response: {
          200: toJsonSchema(intentListResponseSchema),
          400: toJsonSchema(errorResponseSchema),
          401: toJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const parsed = intentListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid input" });
      }
      const { limit, offset, status, customerId } = parsed.data;
      const key = request.apiKey!;

      const filters: SQL[] = [eq(intents.apiKeyId, key.id)];
      if (status) filters.push(eq(intents.status, status));
      if (customerId) filters.push(eq(quotes.customerId, customerId));
      const where = and(...filters);

      const [rows, [{ total }]] = await Promise.all([
        db
          .select({ intent: intents, quote: quotes })
          .from(intents)
          .innerJoin(quotes, eq(quotes.id, intents.quoteId))
          .where(where)
          .orderBy(desc(intents.createdAt), desc(intents.id))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(intents)
          .innerJoin(quotes, eq(quotes.id, intents.quoteId))
          .where(where),
      ]);

      return reply.send({
        items: rows.map(({ intent, quote }) => {
          const req = quote.request as unknown as QuoteBody;
          return {
            id: intent.id,
            quoteId: intent.quoteId,
            customerId: quote.customerId,
            originChainId: req.originChainId,
            destChainId: req.destChainId,
            amountIn: quote.amountIn,
            feeAmount: quote.feeAmount,
            status: intent.status,
            originTx: intent.originTx,
            destTx: intent.destTx,
            error: intent.error,
            createdAt: intent.createdAt.toISOString(),
            updatedAt: intent.updatedAt.toISOString(),
          };
        }),
        total,
        limit,
        offset,
      });
    }
  );
}
