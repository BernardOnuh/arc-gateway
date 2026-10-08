import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { ownedByCaller, requireApiKey } from "../auth/apiKey.js";
import { db } from "../db/index.js";
import { quotes, customers } from "../db/schema.js";
import { resolveToken } from "../tokens.js";
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
          "Sums fees earned (feeBps applied on each quote) across all of the business's API keys, broken down per token and per customer. Optional ?customerId= filters to a single customer. Requires a key created via POST /v1/partners.",
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
          request: quotes.request,
        })
        .from(quotes)
        .where(ownedByCaller(quotes.apiKeyId, key));

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

      const totalsAll = new Totals();
      const grouped = new Map<string | null, Totals>();
      for (const row of rows) {
        const custId = row.customerId ?? null;
        const req = row.request as { originChainId: number; tokenIn: string };
        const token = resolveToken(req.originChainId, req.tokenIn);
        const tokenRef: TokenRef = token
          ? { chainId: token.chainId, symbol: token.symbol, address: token.address, decimals: token.decimals }
          : { chainId: req.originChainId, symbol: req.tokenIn, address: req.tokenIn, decimals: null };
        const amountIn = BigInt(row.amountIn);
        const fee = BigInt(row.feeAmount);
        totalsAll.add(tokenRef, amountIn, fee);
        const group = grouped.get(custId) ?? new Totals();
        group.add(tokenRef, amountIn, fee);
        grouped.set(custId, group);
      }

      const byCustomer = Array.from(grouped.entries()).map(([custId, g]) => {
        const customer = custId === null ? undefined : customerMap.get(custId);
        return {
          customerId: customer?.id ?? null,
          externalId: customer?.externalId ?? null,
          recipientAddress: customer?.recipientAddress ?? null,
          ...g.summary(),
        };
      });

      const all = totalsAll.summary();
      return reply.send({
        partnerId: key.partnerId,
        customerId: customerId ?? null,
        totals: {
          feeBps: key.feeBps,
          transactions: all.transactions,
          amountInTotal: all.amountInTotal,
          feeTotal: all.feeTotal,
        },
        byToken: all.byToken,
        byCustomer,
      });
    }
  );
}

interface TokenRef {
  chainId: number;
  symbol: string;
  address: string;
  decimals: number | null;
}

/** Running sums overall and per origin token (amounts in different tokens can't be added meaningfully). */
class Totals {
  transactions = 0;
  amountIn = 0n;
  fee = 0n;
  private tokens = new Map<string, { token: TokenRef; transactions: number; amountIn: bigint; fee: bigint }>();

  add(token: TokenRef, amountIn: bigint, fee: bigint) {
    this.transactions += 1;
    this.amountIn += amountIn;
    this.fee += fee;
    const id = `${token.chainId}:${token.address.toLowerCase()}`;
    const t = this.tokens.get(id) ?? { token, transactions: 0, amountIn: 0n, fee: 0n };
    t.transactions += 1;
    t.amountIn += amountIn;
    t.fee += fee;
    this.tokens.set(id, t);
  }

  summary() {
    return {
      transactions: this.transactions,
      amountInTotal: this.amountIn.toString(),
      feeTotal: this.fee.toString(),
      byToken: Array.from(this.tokens.values())
        .sort((a, b) => b.transactions - a.transactions || a.token.symbol.localeCompare(b.token.symbol))
        .map((t) => ({
          ...t.token,
          transactions: t.transactions,
          amountInTotal: t.amountIn.toString(),
          feeTotal: t.fee.toString(),
        })),
    };
  }
}
