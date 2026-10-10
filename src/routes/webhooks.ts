import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { and, count, desc, eq } from "drizzle-orm";
import { requireApiKey, type ApiKeyRow } from "../auth/apiKey.js";
import { db } from "../db/index.js";
import { partnerWebhooks, webhookEvents } from "../db/schema.js";
import { errorResponseSchema, okResponseSchema, toJsonSchema } from "../schemas.js";
import { attemptDelivery, newWebhookSecret, webhookUrlProblem } from "../webhooks.js";

const MAX_ENDPOINTS = 5;
const createSchema = z.object({ url: z.string().max(500).describe("HTTPS endpoint that receives signed POSTs.") });
const err = toJsonSchema(errorResponseSchema);
const anyObject = { type: "object", additionalProperties: true };

function partnerOf(request: FastifyRequest, reply: FastifyReply): string | null {
  const key = request.apiKey as ApiKeyRow;
  if (!key.partnerId) {
    reply.code(400).send({ error: "api key is not linked to a partner" });
    return null;
  }
  return key.partnerId;
}

const view = (w: typeof partnerWebhooks.$inferSelect) => ({
  id: w.id,
  url: w.url,
  secret: w.secret,
  active: w.active,
  createdAt: w.createdAt.toISOString(),
});

const eventView = (e: typeof webhookEvents.$inferSelect) => ({
  id: e.id,
  type: e.type,
  status: e.status,
  attempts: e.attempts,
  lastStatusCode: e.lastStatusCode,
  lastError: e.lastError,
  paymentId: e.paymentId,
  createdAt: e.createdAt.toISOString(),
  deliveredAt: e.deliveredAt?.toISOString() ?? null,
  nextAttemptAt: e.status === "pending" ? e.nextAttemptAt.toISOString() : null,
});

async function ownedHook(id: string, partnerId: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [w] = await db
    .select()
    .from(partnerWebhooks)
    .where(and(eq(partnerWebhooks.id, id), eq(partnerWebhooks.partnerId, partnerId)))
    .limit(1);
  return w ?? null;
}

export async function webhookRoutes(app: FastifyInstance) {
  const common = { onRequest: requireApiKey, schema: { tags: ["payments"], security: [{ bearerAuth: [] }] } } as const;

  app.get(
    "/v1/webhooks",
    { ...common, schema: { ...common.schema, summary: "List webhook endpoints", response: { 200: anyObject, 400: err, 401: err, 403: err } } },
    async (request, reply) => {
      const partnerId = partnerOf(request, reply);
      if (!partnerId) return reply;
      const rows = await db
        .select()
        .from(partnerWebhooks)
        .where(and(eq(partnerWebhooks.partnerId, partnerId), eq(partnerWebhooks.active, true)))
        .orderBy(desc(partnerWebhooks.createdAt));
      return reply.send({ items: rows.map(view) });
    }
  );

  app.post(
    "/v1/webhooks",
    {
      ...common,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        ...common.schema,
        summary: "Add a webhook endpoint",
        description:
          "Events: payment.processing, payment.paid, payment.partially_paid, payment.expired. Each POST carries Stableflowr-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, \"<t>.<raw body>\")>, Stableflowr-Event and Stableflowr-Delivery-Id. Non-2xx responses are retried with backoff (8 attempts over ~2 days). Production requires https on a public host.",
        body: toJsonSchema(createSchema),
        response: { 201: anyObject, 400: err, 401: err, 403: err },
      },
    },
    async (request, reply) => {
      const partnerId = partnerOf(request, reply);
      if (!partnerId) return reply;
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "url is required" });
      const problem = webhookUrlProblem(parsed.data.url.trim());
      if (problem) return reply.code(400).send({ error: problem });
      const [{ n }] = await db
        .select({ n: count() })
        .from(partnerWebhooks)
        .where(and(eq(partnerWebhooks.partnerId, partnerId), eq(partnerWebhooks.active, true)));
      if (n >= MAX_ENDPOINTS) return reply.code(400).send({ error: `at most ${MAX_ENDPOINTS} endpoints` });
      const [row] = await db
        .insert(partnerWebhooks)
        .values({ partnerId, url: parsed.data.url.trim(), secret: newWebhookSecret() })
        .returning();
      return reply.code(201).send(view(row));
    }
  );

  app.delete(
    "/v1/webhooks/:id",
    { ...common, schema: { ...common.schema, summary: "Remove a webhook endpoint", response: { 200: toJsonSchema(okResponseSchema), 401: err, 403: err, 404: err } } },
    async (request, reply) => {
      const partnerId = partnerOf(request, reply);
      if (!partnerId) return reply;
      const hook = await ownedHook((request.params as { id: string }).id, partnerId);
      if (!hook) return reply.code(404).send({ error: "webhook not found" });
      await db.update(partnerWebhooks).set({ active: false }).where(eq(partnerWebhooks.id, hook.id));
      return reply.send({ ok: true });
    }
  );

  app.post(
    "/v1/webhooks/:id/test",
    {
      ...common,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { ...common.schema, summary: "Send a test event", description: "Sends a signed ping now and returns the delivery result.", response: { 200: anyObject, 401: err, 403: err, 404: err } },
    },
    async (request, reply) => {
      const partnerId = partnerOf(request, reply);
      if (!partnerId) return reply;
      const hook = await ownedHook((request.params as { id: string }).id, partnerId);
      if (!hook) return reply.code(404).send({ error: "webhook not found" });
      const [event] = await db
        .insert(webhookEvents)
        .values({ webhookId: hook.id, type: "ping", payload: { type: "ping", created: new Date().toISOString(), data: { message: "Hello from Stableflowr" } } })
        .returning();
      return reply.send(eventView(await attemptDelivery(event)));
    }
  );

  app.get(
    "/v1/webhooks/:id/events",
    { ...common, schema: { ...common.schema, summary: "Recent deliveries", response: { 200: anyObject, 401: err, 403: err, 404: err } } },
    async (request, reply) => {
      const partnerId = partnerOf(request, reply);
      if (!partnerId) return reply;
      const hook = await ownedHook((request.params as { id: string }).id, partnerId);
      if (!hook) return reply.code(404).send({ error: "webhook not found" });
      const rows = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.webhookId, hook.id))
        .orderBy(desc(webhookEvents.createdAt))
        .limit(25);
      return reply.send({ items: rows.map(eventView) });
    }
  );
}
