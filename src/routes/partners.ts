import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { generateApiKey } from "../auth/apiKey.js";
import { db } from "../db/index.js";
import { apiKeys, partners } from "../db/schema.js";
import {
  partnerCreateSchema,
  partnerResponseSchema,
  errorResponseSchema,
  toJsonSchema,
} from "../schemas.js";

export async function partnerRoutes(app: FastifyInstance) {
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
}
