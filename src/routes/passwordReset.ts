import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { generateToken, hashPassword, sha256 } from "../auth/customer.js";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { apiKeys, partnerPasswordResets, partnerSessions, partners } from "../db/schema.js";
import { actionEmail, sendEmail } from "../email.js";
import { errorResponseSchema, okResponseSchema, toJsonSchema } from "../schemas.js";

const RESET_TTL_MS = 60 * 60 * 1000;
const requestSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const confirmSchema = z.object({
  token: z.string().min(10).max(200),
  newPassword: z.string().min(10, "password must be at least 10 characters").max(200),
});
const ok = toJsonSchema(okResponseSchema);
const err = toJsonSchema(errorResponseSchema);

export async function passwordResetRoutes(app: FastifyInstance) {
  app.post(
    "/v1/partners/password-reset",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        tags: ["partners"],
        summary: "Email a password reset link",
        description: "Always answers 200, whether or not the email has an account, so it can't be used to find accounts. The link is valid for 1 hour.",
        body: toJsonSchema(requestSchema),
        response: { 200: ok, 400: err },
      },
    },
    async (request, reply) => {
      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "a valid email is required" });
      const [partner] = await db
        .select({ id: partners.id, name: partners.name })
        .from(partners)
        .where(and(sql`lower(${partners.email}) = ${parsed.data.email}`, eq(partners.active, true)))
        .limit(1);
      if (partner) {
        // One live link at a time.
        await db
          .update(partnerPasswordResets)
          .set({ usedAt: new Date() })
          .where(and(eq(partnerPasswordResets.partnerId, partner.id), isNull(partnerPasswordResets.usedAt)));
        const { raw, hash } = generateToken("cst_");
        await db.insert(partnerPasswordResets).values({ partnerId: partner.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_TTL_MS) });
        const url = `${config.appUrl}/app/reset-password?token=${encodeURIComponent(raw)}`;
        await sendEmail(
          {
            to: parsed.data.email,
            subject: "Reset your ARC Gateway password",
            ...actionEmail({
              heading: "Reset your password",
              body: `Someone asked to reset the password for ${partner.name}. The link works once and expires in an hour.`,
              action: "Choose a new password",
              url,
              footer: "If you didn't ask for this, ignore this email; your password stays the same.",
            }),
          },
          request.log
        );
      }
      return reply.send({ ok: true });
    }
  );

  app.post(
    "/v1/partners/password-reset/confirm",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["partners"],
        summary: "Set a new password with a reset link",
        description: "Uses the token from the email once, sets the password, and signs out every dashboard session of the business.",
        body: toJsonSchema(confirmSchema),
        response: { 200: ok, 400: err },
      },
    },
    async (request, reply) => {
      const parsed = confirmSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      const tokenHash = sha256(parsed.data.token);
      const passwordHash = await hashPassword(parsed.data.newPassword);
      const done = await db.transaction(async (tx) => {
        // Claim the token atomically so it can't be used twice.
        const [reset] = await tx
          .update(partnerPasswordResets)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(partnerPasswordResets.tokenHash, tokenHash),
              isNull(partnerPasswordResets.usedAt),
              gt(partnerPasswordResets.expiresAt, new Date())
            )
          )
          .returning();
        if (!reset) return false;
        await tx.update(partners).set({ passwordHash }).where(eq(partners.id, reset.partnerId));
        await tx
          .delete(partnerSessions)
          .where(inArray(partnerSessions.apiKeyId, tx.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.partnerId, reset.partnerId))));
        return true;
      });
      if (!done) return reply.code(400).send({ error: "this reset link is invalid, used or expired; request a new one" });
      return reply.send({ ok: true });
    }
  );
}
