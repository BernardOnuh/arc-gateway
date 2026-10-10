import type { FastifyInstance } from "fastify";
import { findActiveKey } from "../auth/apiKey.js";
import {
  SESSION_COOKIE,
  authenticatePartnerPassword,
  clearPartnerLoginFailures,
  createPartnerSession,
  partnerLoginLocked,
  recordPartnerLoginFailure,
  deletePartnerSession,
  sessionCookieOptions,
} from "../auth/partnerSession.js";
import {
  dashboardSessionCreateSchema,
  dashboardSessionResponseSchema,
  errorResponseSchema,
  okResponseSchema,
  toJsonSchema,
} from "../schemas.js";

const err = toJsonSchema(errorResponseSchema);

export async function dashboardSessionRoutes(app: FastifyInstance) {
  app.post(
    "/v1/dashboard/session",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["partners"],
        summary: "Open a dashboard session",
        description:
          "Signs in with the business email + password, or with a secret key, and sets an httpOnly session cookie (arc_session, 7 days) so the dashboard never keeps a key in browser storage. 5 failed passwords per email in 15 minutes → 429. Requests authenticated by the cookie must also send `x-arc-dashboard: 1`. Revoking the key ends its sessions; rotating moves the session to the new key.",
        body: toJsonSchema(dashboardSessionCreateSchema),
        response: { 200: toJsonSchema(dashboardSessionResponseSchema), 400: err, 401: err, 403: err, 429: err },
      },
    },
    async (request, reply) => {
      const parsed = dashboardSessionCreateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid input" });

      let key;
      if ("email" in parsed.data) {
        const { email, password } = parsed.data;
        if (await partnerLoginLocked(request, email)) {
          return reply.code(429).send({ error: "too many attempts; wait 15 minutes" });
        }
        key = await authenticatePartnerPassword(email, password);
        if (!key) {
          await recordPartnerLoginFailure(request, email);
          return reply.code(401).send({ error: "wrong email or password" });
        }
        await clearPartnerLoginFailures(request, email);
      } else {
        key = await findActiveKey(parsed.data.apiKey.trim());
        if (!key) return reply.code(401).send({ error: "unauthorized" });
      }
      if (key.kind !== "secret") {
        return reply.code(403).send({ error: "sign in with your secret key, not a publishable key" });
      }
      if (!key.partnerId) return reply.code(400).send({ error: "api key is not linked to a partner" });

      const { token, expiresAt } = await createPartnerSession(key.id);
      reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
      return reply.send({ expiresAt: expiresAt.toISOString() });
    }
  );

  app.post(
    "/v1/dashboard/session/logout",
    {
      schema: {
        tags: ["partners"],
        summary: "End the dashboard session",
        description: "Deletes the session behind the cookie and clears it. Safe to call when signed out.",
        response: { 200: toJsonSchema(okResponseSchema) },
      },
    },
    async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE];
      if (token) await deletePartnerSession(token);
      reply.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
      return reply.send({ ok: true });
    }
  );
}
