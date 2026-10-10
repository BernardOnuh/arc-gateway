import Fastify, { type FastifyError, type RouteOptions } from "fastify";
import { Redis } from "ioredis";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "./config.js";
import { requireApiKey } from "./auth/apiKey.js";
import { DASHBOARD_HEADER } from "./auth/partnerSession.js";
import { globalRateLimitOptions } from "./auth/rateLimit.js";
import { metaRoutes, type EndpointInfo } from "./routes/meta.js";
import { catalogRoutes } from "./routes/catalog.js";
import { partnerRoutes } from "./routes/partners.js";
import { apiKeyRoutes } from "./routes/apiKeys.js";
import { dashboardSessionRoutes } from "./routes/dashboardSession.js";
import { customerRoutes } from "./routes/customers.js";
import { customerAccountRoutes } from "./routes/customerAccounts.js";
import { ledgerRoutes } from "./routes/ledger.js";
import { quoteRoutes } from "./routes/quotes.js";
import { paymentRoutes } from "./routes/payments.js";
import { brandingRoutes } from "./routes/branding.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { passwordResetRoutes } from "./routes/passwordReset.js";
import { sweepPayments } from "./routes/payments.js";
import { deliverDue } from "./webhooks.js";
import { intentRoutes } from "./routes/intents.js";

export type App = Awaited<ReturnType<typeof buildApp>>;

function isAuthRoute(route: RouteOptions): boolean {
  const has = (h: unknown): boolean => {
    const list = Array.isArray(h) ? h : [h];
    return list.includes(requireApiKey as unknown);
  };
  return has(route.onRequest) || has(route.preHandler);
}

/** Routes the browser widget calls from partner sites (see config.publishable on the routes). */
export function isWidgetRoute(method: string, url: string): boolean {
  const path = url.split("?")[0];
  if (method === "GET" && (path === "/v1/chains" || path === "/v1/tokens")) return true;
  if (method === "POST" && path === "/v1/quotes") return true;
  if (method === "GET" && path === "/v1/prices") return true;
  // Checkout: read a payment, quote legs, report leg transactions.
  if (method === "GET" && /^\/v1\/payments\/[^/]+$/.test(path)) return true;
  if (method === "POST" && /^\/v1\/payments\/[^/]+\/legs(\/[^/]+\/submitted)?$/.test(path)) return true;
  return method === "GET" && /^\/v1\/intents\/[^/]+$/.test(path);
}

export async function buildApp() {
  const app = Fastify({
    logger: config.isTest ? false : { level: config.logLevel, redact: ["req.headers.authorization", "req.headers.cookie"] },
    // Trust exactly N proxy hops so req.ip is the real client behind a load balancer.
    trustProxy: config.trustProxy > 0 ? (_address: string, hop: number) => hop < config.trustProxy : false,
    ajv: { customOptions: { strict: false } },
  });

  // Schema validation failures answer like every other error: { error: "<readable reason>" }.
  app.setErrorHandler((err: FastifyError, _request, reply) => {
    if (err.validation) {
      const first = err.validation[0];
      const params = (first?.params ?? {}) as { missingProperty?: string; limit?: number };
      const field = params.missingProperty ?? first?.instancePath.replace(/^\//, "") ?? "";
      let error = "invalid input";
      if (params.missingProperty) error = `${field} is required`;
      else if (first?.keyword === "minLength" && field) error = `${field} must be at least ${params.limit} characters`;
      else if (field) error = `${field} ${first?.message ?? "is invalid"}`;
      return reply.code(400).send({ error });
    }
    // Everything else keeps its own status (429 from the rate limiter, 500 otherwise).
    reply.code(err.statusCode && err.statusCode >= 400 ? err.statusCode : 500);
    return reply.send(err);
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
          dashboardSession: { type: "apiKey", in: "cookie", name: "arc_session", description: "Dashboard session from POST /v1/dashboard/session; send x-arc-dashboard: 1 with it" },
          customerSession: { type: "http", scheme: "bearer", description: "Customer session token (cs_...) from /v1/customer-auth" },
        },
      },
      tags: [
        { name: "meta", description: "Service discovery, health and auth check" },
        { name: "partners", description: "Business onboarding and API-key creation" },
        { name: "customers", description: "End-customer registry for partner transactions" },
        { name: "customer-accounts", description: "End-customer self-service: password, sessions, payout wallet" },
        { name: "quotes", description: "Chain/token discovery and fee-adjusted swap quotes" },
        { name: "intents", description: "Intent submission and status polling" },
        { name: "payments", description: "Checkout: a USD price paid with any mix of tokens, settled in USDC on ARC" },
        { name: "ledger", description: "Partner revenue and per-customer transaction breakdown" },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(cookie);
  // Security headers. The API serves JSON (plus Swagger UI at /docs, which needs its inline assets), so no CSP.
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } });

  const wildcard = config.corsOrigins.includes("*");
  const dashboardOrigins = wildcard ? true : config.corsOrigins;
  await app.register(cors, {
    // Widget routes answer any origin at the CORS layer; publishable keys then
    // enforce their own per-key origin allowlist (auth/apiKey.ts). Everything
    // else is limited to CORS_ORIGINS (the dashboard), which alone may send
    // the session cookie. Widget responses never allow credentials.
    delegator: (req, cb) => {
      const method =
        req.method === "OPTIONS" ? String(req.headers["access-control-request-method"] ?? "") : req.method;
      const widget = isWidgetRoute(method, req.url ?? "");
      cb(null, {
        origin: widget ? true : dashboardOrigins,
        credentials: !widget && !wildcard,
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["authorization", "content-type", DASHBOARD_HEADER],
        maxAge: 600,
      });
    },
  });

  await app.register(rateLimit, globalRateLimitOptions(redis));

  // Routes are attached directly (not via app.register) so they share the root
  // scope: the onRoute endpoint index and global rate limit see every route.
  await metaRoutes(app, { endpoints, redis });
  await catalogRoutes(app);
  await partnerRoutes(app);
  await apiKeyRoutes(app);
  await dashboardSessionRoutes(app);
  await customerRoutes(app);
  await customerAccountRoutes(app);
  await ledgerRoutes(app);
  await quoteRoutes(app);
  await paymentRoutes(app);
  await brandingRoutes(app);
  await webhookRoutes(app);
  await passwordResetRoutes(app);
  await intentRoutes(app);

  return app;
}

async function bootstrap() {
  const app = await buildApp();
  // Graceful shutdown: stop accepting requests, finish in-flight ones, close DB/Redis.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      app.log.info(`${signal} received, shutting down`);
      app
        .close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
  }
  startWorkers(app);
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`arc-gateway listening on http://localhost:${config.port}`);
  app.log.info(`Swagger UI: http://localhost:${config.port}/docs`);
  app.log.info(`Endpoint index: http://localhost:${config.port}/`);
  console.log(app.printRoutes({ commonPrefix: false }));
}

/**
 * Background loops (not started in tests): deliver due webhooks every 5s and
 * sweep payments every 15s. Safe with several instances: deliveries are
 * claimed with SKIP LOCKED and status changes are conditional updates.
 */
function startWorkers(app: App) {
  const loop = (name: string, everyMs: number, fn: () => Promise<unknown>) => {
    let running = false;
    const timer = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        await fn();
      } catch (e) {
        app.log.error({ err: e }, `${name} failed`);
      } finally {
        running = false;
      }
    }, everyMs);
    app.addHook("onClose", async () => clearInterval(timer));
  };
  loop("webhook delivery", 5_000, () => deliverDue());
  loop("payment sweep", 15_000, () => sweepPayments());
}

if (!config.isTest) {
  bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
