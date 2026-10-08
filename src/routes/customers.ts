import type { FastifyInstance } from "fastify";
import { eq, and, desc, count } from "drizzle-orm";
import { requireApiKey } from "../auth/apiKey.js";
import { db } from "../db/index.js";
import { customers } from "../db/schema.js";
import {
  customerCreateSchema,
  customerResponseSchema,
  customerListQuerySchema,
  customerListResponseSchema,
  errorResponseSchema,
  toJsonSchema,
} from "../schemas.js";

export async function customerRoutes(app: FastifyInstance) {
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

  app.get(
    "/v1/customers",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["customers"],
        summary: "List end customers",
        description:
          "Lists the authenticated partner's registered customers, newest first. Paginate with ?limit=&offset=; total is the full count.",
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(customerListQuerySchema),
        response: {
          200: toJsonSchema(customerListResponseSchema),
          400: toJsonSchema(errorResponseSchema),
          401: toJsonSchema(errorResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const parsed = customerListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid input" });
      }
      const key = request.apiKey!;
      if (!key.partnerId) {
        return reply.code(400).send({ error: "api key is not linked to a partner" });
      }
      const { limit, offset } = parsed.data;
      const where = eq(customers.partnerId, key.partnerId);

      const [rows, [{ total }]] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(where)
          .orderBy(desc(customers.createdAt), desc(customers.id))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(customers).where(where),
      ]);

      return reply.send({
        items: rows.map((c) => ({
          customerId: c.id,
          externalId: c.externalId,
          recipientAddress: c.recipientAddress,
          createdAt: c.createdAt.toISOString(),
        })),
        total,
        limit,
        offset,
      });
    }
  );
}
