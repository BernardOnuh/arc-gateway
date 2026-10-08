import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CHAINS, listChains } from "../chains.js";
import { getTokens } from "../tokens.js";
import { chainsResponseSchema, tokensResponseSchema, toJsonSchema } from "../schemas.js";

export async function catalogRoutes(app: FastifyInstance) {
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
}
