import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { requireApiKey } from "../auth/apiKey.js";
import { pool } from "../db/index.js";
import { healthResponseSchema, toJsonSchema } from "../schemas.js";

export interface EndpointInfo {
  method: string;
  path: string;
  auth: boolean;
}

export async function metaRoutes(
  app: FastifyInstance,
  { endpoints, redis }: { endpoints: EndpointInfo[]; redis: Redis }
) {
  app.get(
    "/",
    {
      schema: {
        tags: ["meta"],
        summary: "Endpoint index",
        description: "Machine-readable list of every route on this gateway.",
      },
    },
    async (_request, reply) => {
      return reply.send({
        service: "arc-gateway",
        version: "1.0.0",
        docs: "/docs",
        openapi: "/openapi.json",
        endpoints,
      });
    }
  );

  app.get(
    "/openapi.json",
    { schema: { tags: ["meta"], summary: "OpenAPI document" } },
    async (_request, reply) => reply.send(app.swagger())
  );

  app.get(
    "/health",
    {
      schema: {
        tags: ["meta"],
        summary: "Liveness/readiness",
        response: {
          200: toJsonSchema(healthResponseSchema),
          503: toJsonSchema(healthResponseSchema),
        },
      },
    },
    async (_request, reply) => {
      let dbStatus: "up" | "down" = "down";
      let redisStatus: "up" | "down" = "down";

      try {
        await pool.query("SELECT 1");
        dbStatus = "up";
      } catch {
        dbStatus = "down";
      }

      try {
        redisStatus = (await redis.ping()) === "PONG" ? "up" : "down";
      } catch {
        redisStatus = "down";
      }

      const status = dbStatus === "up" && redisStatus === "up" ? "ok" : "degraded";
      return reply
        .status(status === "ok" ? 200 : 503)
        .send({ status, db: dbStatus, redis: redisStatus });
    }
  );

  app.get(
    "/protected",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["meta"],
        summary: "Auth check",
        description: "Returns 200 if the bearer API key is valid, 401 otherwise.",
        security: [{ bearerAuth: [] }],
        response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } },
      },
    },
    async (_request, reply) => reply.send({ ok: true })
  );
}
