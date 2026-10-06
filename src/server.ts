import Fastify from "fastify";
import { Client as PgClient } from "pg";
import Redis from "ioredis";
import { requireApiKey } from "./auth/apiKey.js";
import { rateLimitPlugin } from "./auth/rateLimit.js";
import { db } from "./db/index.js";
import { apiKeys, quotes, intents } from "./db/schema.js";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { computeFee } from "./fees.js";
import { type UpstreamQuote, type QuoteRequest } from "./providers/types.js";
import { mockProvider } from "./providers/mock.js";

export type App = Awaited<ReturnType<typeof buildApp>>;

export async function buildApp() {
  const app = Fastify({
    logger: false,
  });

  await app.register(rateLimitPlugin, {
    redisUrl: process.env.REDIS_URL!,
  });

  app.get("/health", async (_request, reply) => {
    let dbStatus = "down";
    let redisStatus = "down";

    try {
      const pg = new PgClient({ connectionString: process.env.DATABASE_URL });
      await pg.connect();
      await pg.query("SELECT 1");
      await pg.end();
      dbStatus = "up";
    } catch {
      dbStatus = "down";
    }

    try {
      const rc = new (Redis as any)(process.env.REDIS_URL!);
      const pong = await rc.ping();
      rc.disconnect();
      redisStatus = pong === "PONG" ? "up" : "down";
    } catch {
      redisStatus = "down";
    }

    const status = dbStatus === "up" && redisStatus === "up" ? "ok" : "degraded";
    return reply
      .status(status === "ok" ? 200 : 503)
      .send({ status, db: dbStatus, redis: redisStatus });
  });

  app.get("/protected", { preHandler: requireApiKey }, async (_request, reply) => {
    return reply.send({ ok: true });
  });

  // ----- /v1/quotes -----
  const quoteBodySchema = z.object({
    originChainId: z.number().int().positive(),
    destChainId: z.number().int().positive(),
    tokenIn: z.string().nonempty(),
    tokenOut: z.string().nonempty(),
    amountIn: z.string().regex(/^\d+$/),
    recipient: z.string().nonempty(),
    slippageBps: z.number().int().min(0).max(100),
    deadlineSeconds: z
      .number()
      .int()
      .positive()
      .refine((d) => d > Math.floor(Date.now() / 1000), {
        message: "deadline must be in the future",
      }),
  });

  app.post(
    "/v1/quotes",
    { preHandler: requireApiKey },
    async (request, reply) => {
      const parsed = quoteBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid input" });
      }

      const body = parsed.data as z.infer<typeof quoteBodySchema>;

      // Look up partner's fee_bps
      const keyId = (request as any).apiKey.id;
      const partner = await db
        .select({ feeBps: apiKeys.feeBps })
        .from(apiKeys)
        .where(eq(apiKeys.id, keyId))
        .limit(1);

      if (partner.length === 0) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const feeBps = partner[0].feeBps;

      // Compute fee on the FULL amountIn (client-supplied), then net amount goes to upstream
      const amountInBig = BigInt(body.amountIn);
      if (amountInBig <= 0n) {
        return reply.code(400).send({ error: "amount must be positive" });
      }
      const { fee, netAmount } = computeFee(amountInBig, feeBps);

      // Request upstream quote on net amount
      const req: QuoteRequest = {
        originChainId: body.originChainId,
        destChainId: body.destChainId,
        tokenIn: body.tokenIn,
        tokenOut: body.tokenOut,
        amountIn: netAmount.toString(),
        recipient: body.recipient,
        slippageBps: body.slippageBps,
        deadlineSeconds: body.deadlineSeconds,
      };

      const upstreamQuote = await mockProvider.getQuote(req);

      // Persist the quote with stored fee info
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const [storedQuote] = await db
        .insert(quotes)
        .values({
          apiKeyId: keyId,
          provider: mockProvider.name,
          upstreamQuoteId: upstreamQuote.id,
          request: body,
          response: {
            estimatedOut: upstreamQuote.estimatedOut,
            minOut: upstreamQuote.minOut,
          },
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
        expiresAt: Math.floor(storedQuote.expiresAt.getTime() / 1000),
        unsignedTx: upstreamQuote.unsignedTx,
      });
    }
  );

  // ----- /v1/intents/submit -----
  const submitBodySchema = z.object({
    quoteId: z.string().nonempty(),
    signedPayload: z.string().nonempty(),
  });

  app.post(
    "/v1/intents/submit",
    { preHandler: requireApiKey },
    async (request, reply) => {
      const parsed = submitBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid input" });
      }

      const { quoteId } = parsed.data;
      const keyId = (request as any).apiKey.id;

      // Check quote belongs to this key
      const quote = await db
        .select()
        .from(quotes)
        .where(and(eq(quotes.id, quoteId), eq(quotes.apiKeyId, keyId)))
        .limit(1);

      if (quote.length === 0) {
        return reply.code(400).send({ error: "quote not found or not yours" });
      }

      // Check expired - compare as numbers
      const quoteExpiresAt = Math.floor(quote[0].expiresAt.getTime() / 1000);
      const now = Math.floor(Date.now() / 1000);
      if (now > quoteExpiresAt) {
        return reply.code(400).send({ error: "quote expired" });
      }

      // Idempotent: check if already has an intent for this quote
      const existingIntent = await db
        .select({ id: intents.id })
        .from(intents)
        .where(eq(intents.quoteId, quoteId))
        .limit(1);

      if (existingIntent.length > 0) {
        return reply.send({ intentId: existingIntent[0].id });
      }

      // Call provider submit
      const upstreamQuoteRes = await db
        .select()
        .from(quotes)
        .where(eq(quotes.id, quoteId))
        .limit(1);

      if (upstreamQuoteRes.length === 0) {
        return reply.code(500).send({ error: "quote not found" });
      }

      const signedPayload = parsed.data.signedPayload;
      const upstreamId = `intent-${Date.now()}-mock`;
      const intentId = uuidv4();

      await mockProvider.submit(
        upstreamQuoteRes[0] as unknown as UpstreamQuote,
        signedPayload
      );

      // Create intents row with status PENDING
      await db.insert(intents).values({
        id: intentId,
        quoteId: quoteId,
        apiKeyId: keyId,
        status: "PENDING" as const,
        originTx: null,
        destTx: null,
        upstreamId: upstreamId,
        error: null,
      });

      return reply.send({ intentId });
    }
  );

  // ----- GET /v1/intents/:id -----
  app.get(
    "/v1/intents/:id",
    { preHandler: requireApiKey },
    async (request, reply) => {
      const keyId = (request as any).apiKey.id;
      const intentId = (request.params as { id: string }).id;

      // Get intent from DB
      const intent = await db
        .select()
        .from(intents)
        .where(and(eq(intents.id, intentId), eq(intents.apiKeyId, keyId)))
        .limit(1);

      if (intent.length === 0) {
        return reply.code(404).send({ error: "not found" });
      }

      // Advance status via mock provider
      const currentStatus = await mockProvider.getStatus(
        intent[0].upstreamId as string
      );

      return reply.send({
        id: intent[0].id,
        status: currentStatus,
        originTx: intent[0].originTx,
        destTx: intent[0].destTx,
        upstreamId: intent[0].upstreamId,
        error: intent[0].error,
        createdAt: intent[0].createdAt,
        updatedAt: intent[0].updatedAt,
      });
    }
  );

  return app;
}

async function bootstrap() {
  const port = Number(process.env.PORT || 3000);
  const app = await buildApp();
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Server listening on port ${port}`);
}

if (process.env.NODE_ENV !== "test") {
  bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
