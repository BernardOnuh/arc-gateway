import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { generateApiKey, requireApiKey, type ApiKeyRow } from "../auth/apiKey.js";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import {
  apiKeyListResponseSchema,
  apiKeyRevokeSchema,
  apiKeyRotateResponseSchema,
  apiKeySummarySchema,
  errorResponseSchema,
  publishableKeyCreateSchema,
  toJsonSchema,
} from "../schemas.js";

function summarize(row: ApiKeyRow, caller: ApiKeyRow) {
  return {
    id: row.id,
    kind: row.kind,
    keyPrefix: row.keyPrefix,
    last4: row.last4,
    publishableKey: row.kind === "publishable" ? row.publicKey : null,
    allowedOrigins: row.allowedOrigins ?? null,
    active: row.active,
    current: row.id === caller.id,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

/** Key management is for the partner's own secret key only. */
function partnerSecretKey(request: FastifyRequest, reply: FastifyReply): (ApiKeyRow & { partnerId: string }) | null {
  const key = request.apiKey!;
  if (!key.partnerId) {
    reply.code(400).send({ error: "api key is not linked to a partner" });
    return null;
  }
  return key as ApiKeyRow & { partnerId: string };
}

const errors = {
  400: toJsonSchema(errorResponseSchema),
  401: toJsonSchema(errorResponseSchema),
  403: toJsonSchema(errorResponseSchema),
};

export async function apiKeyRoutes(app: FastifyInstance) {
  app.get(
    "/v1/partners/me/api-keys",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["partners"],
        summary: "List API keys",
        description:
          "All secret and publishable keys of the authenticated business, newest first, including revoked ones. Secret keys are never returned in full.",
        security: [{ bearerAuth: [] }],
        response: { 200: toJsonSchema(apiKeyListResponseSchema), ...errors },
      },
    },
    async (request, reply) => {
      const key = partnerSecretKey(request, reply);
      if (!key) return reply;
      const rows = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.partnerId, key.partnerId))
        .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id));
      return reply.send({ items: rows.map((r) => summarize(r, key)) });
    }
  );

  app.post(
    "/v1/partners/me/api-keys/rotate",
    {
      onRequest: requireApiKey,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        tags: ["partners"],
        summary: "Rotate your secret key",
        description:
          "Issues a new secret key with the same fee and rate limit and revokes the key that made this request, atomically. The new key is shown once. Quotes, intents and ledger history carry over (they are scoped to the business, not the key).",
        security: [{ bearerAuth: [] }],
        response: { 201: toJsonSchema(apiKeyRotateResponseSchema), ...errors },
      },
    },
    async (request, reply) => {
      const key = partnerSecretKey(request, reply);
      if (!key) return reply;
      const fresh = generateApiKey("secret");
      const created = await db.transaction(async (tx) => {
        const revoked = await tx
          .update(apiKeys)
          .set({ active: false, revokedAt: new Date() })
          .where(and(eq(apiKeys.id, key.id), eq(apiKeys.active, true)))
          .returning({ id: apiKeys.id });
        // A concurrent rotate already revoked this key; don't mint a second one.
        if (revoked.length === 0) return null;
        const [row] = await tx
          .insert(apiKeys)
          .values({
            partnerId: key.partnerId,
            partnerName: key.partnerName,
            kind: "secret",
            keyPrefix: fresh.keyPrefix,
            keyHash: fresh.keyHash,
            last4: fresh.last4,
            feeBps: key.feeBps,
            rateLimitPerMin: key.rateLimitPerMin,
            active: true,
          })
          .returning();
        return row;
      });
      if (!created) return reply.code(401).send({ error: "unauthorized" });
      return reply.code(201).send({ apiKey: fresh.rawKey, key: summarize(created, key) });
    }
  );

  app.post(
    "/v1/partners/me/api-keys/publishable",
    {
      onRequest: requireApiKey,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["partners"],
        summary: "Create a publishable key",
        description:
          "Creates a pk_live_ key for the browser widget. It can only create quotes (POST /v1/quotes) and read intent status (GET /v1/intents/:id), and only from the listed origins; every other endpoint returns 403. It cannot submit intents: submit from your server with your secret key.",
        security: [{ bearerAuth: [] }],
        body: {
          ...toJsonSchema(publishableKeyCreateSchema),
          example: { allowedOrigins: ["https://shop.example.com"] },
        },
        response: { 201: toJsonSchema(apiKeySummarySchema), ...errors },
      },
    },
    async (request, reply) => {
      const key = partnerSecretKey(request, reply);
      if (!key) return reply;
      const parsed = publishableKeyCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      }
      const fresh = generateApiKey("publishable");
      const [row] = await db
        .insert(apiKeys)
        .values({
          partnerId: key.partnerId,
          partnerName: key.partnerName,
          kind: "publishable",
          keyPrefix: fresh.keyPrefix,
          keyHash: fresh.keyHash,
          last4: fresh.last4,
          publicKey: fresh.rawKey,
          allowedOrigins: [...new Set(parsed.data.allowedOrigins)],
          feeBps: key.feeBps,
          rateLimitPerMin: key.rateLimitPerMin,
          active: true,
        })
        .returning();
      return reply.code(201).send(summarize(row, key));
    }
  );

  app.post(
    "/v1/partners/me/api-keys/revoke",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["partners"],
        summary: "Revoke a key",
        description:
          "Revokes one of the business's keys immediately. Idempotent. You cannot revoke the key making the request; use rotate for that, so you are never locked out.",
        security: [{ bearerAuth: [] }],
        body: {
          ...toJsonSchema(apiKeyRevokeSchema),
          example: { keyId: "00000000-0000-0000-0000-000000000000" },
        },
        response: { 200: toJsonSchema(apiKeySummarySchema), ...errors, 404: toJsonSchema(errorResponseSchema) },
      },
    },
    async (request, reply) => {
      const key = partnerSecretKey(request, reply);
      if (!key) return reply;
      const parsed = apiKeyRevokeSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
      const { keyId } = parsed.data;
      if (keyId === key.id) {
        return reply.code(400).send({ error: "cannot revoke the key making this request; rotate it instead" });
      }
      const [target] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.id, keyId), eq(apiKeys.partnerId, key.partnerId)))
        .limit(1);
      if (!target) return reply.code(404).send({ error: "key not found" });
      if (!target.active) return reply.send(summarize(target, key));
      const [updated] = await db
        .update(apiKeys)
        .set({ active: false, revokedAt: new Date() })
        .where(eq(apiKeys.id, keyId))
        .returning();
      return reply.send(summarize(updated, key));
    }
  );
}
