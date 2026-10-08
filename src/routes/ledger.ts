import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireApiKey } from "../auth/apiKey.js";
import { db } from "../db/index.js";
import { quotes, customers } from "../db/schema.js";
import { ledgerResponseSchema, errorResponseSchema, toJsonSchema } from "../schemas.js";

export async function ledgerRoutes(app: FastifyInstance) {
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
}
