import Fastify, { type RouteOptions } from "fastify";
import { Redis } from "ioredis";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "./config.js";
import { requireApiKey } from "./auth/apiKey.js";
import { globalRateLimitOptions } from "./auth/rateLimit.js";
import { metaRoutes, type EndpointInfo } from "./routes/meta.js";
import { catalogRoutes } from "./routes/catalog.js";
import { partnerRoutes } from "./routes/partners.js";
import { customerRoutes } from "./routes/customers.js";
import { ledgerRoutes } from "./routes/ledger.js";
import { quoteRoutes } from "./routes/quotes.js";
import { intentRoutes } from "./routes/intents.js";

export type App = Awaited<ReturnType<typeof buildApp>>;

function isAuthRoute(route: RouteOptions): boolean {
  const has = (h: unknown): boolean => {
    const list = Array.isArray(h) ? h : [h];
    return list.includes(requireApiKey as unknown);
  };
  return has(route.onRequest) || has(route.preHandler);
}

export async function buildApp() {
  const app = Fastify({
    logger: config.isTest ? false : { level: config.logLevel },
    ajv: { customOptions: { strict: false } },
  });

  const endpoints: EndpointInfo[] = [];
  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (method === "HEAD" || method === "OPTIONS" || method === "*") continue;
      if (!endpoints.some((e) => e.method === method && e.path === route.url)) {
        endpoints.push({ method, path: route.url, auth: isAuthRoute(route) });
      }
    }
  });

  const redis = new Redis(config.redisUrl);
  app.decorate("redis", redis);
  app.addHook("onClose", async () => {
    redis.disconnect();
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "arc-gateway",
        description:
          "B2B gateway to the ARC network. Businesses self-serve via POST /v1/partners (api key shown once, partner fee charged on amountIn), register their end customers via POST /v1/customers, attribute transactions with customerId, and see revenue in GET /v1/ledger. Partners authenticate with a bearer API key, request cross-chain quotes (a partner fee is charged on amountIn), submit signed intents and poll intent status.\n\nSupported chains: Ethereum (1), Base (8453), Arc (5042), Arc Testnet (5042002) plus BNB (56) / Robinhood (4663) registry entries. Token contracts are real and verified on-chain. Pricing source is pluggable via QUOTE_PROVIDER: \"mock\" (simulated reference prices) or \"arc\" (live Circle Swap solver quotes via App Kit). With \"arc\", swap liquidity exists for Ethereum/Base -> Arc (USDC/EURC destinations).",
        version: "1.0.0",
      },
      servers: [{ url: `http://localhost:${config.port}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", description: "Partner API key (gw_live_...)" },
        },
      },
      tags: [
        { name: "meta", description: "Service discovery, health and auth check" },
        { name: "partners", description: "Business onboarding and API-key creation" },
        { name: "customers", description: "End-customer registry for partner transactions" },
        { name: "quotes", description: "Chain/token discovery and fee-adjusted swap quotes" },
        { name: "intents", description: "Intent submission and status polling" },
        { name: "ledger", description: "Partner revenue and per-customer transaction breakdown" },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(rateLimit, globalRateLimitOptions(redis));

  // Routes are attached directly (not via app.register) so they share the root
  // scope: the onRoute endpoint index and global rate limit see every route.
  await metaRoutes(app, { endpoints, redis });
  await catalogRoutes(app);
  await partnerRoutes(app);
  await customerRoutes(app);
  await ledgerRoutes(app);
  await quoteRoutes(app);
  await intentRoutes(app);

  return app;
}

async function bootstrap() {
  const app = await buildApp();
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`arc-gateway listening on http://localhost:${config.port}`);
  app.log.info(`Swagger UI: http://localhost:${config.port}/docs`);
  app.log.info(`Endpoint index: http://localhost:${config.port}/`);
  console.log(app.printRoutes({ commonPrefix: false }));
}

if (!config.isTest) {
  bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
