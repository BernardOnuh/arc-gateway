import type { FastifyInstance } from "fastify";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { requireApiKey } from "../auth/apiKey.js";
import {
  clearLoginFailures,
  createSession,
  dummyPasswordHash,
  generateToken,
  hashPassword,
  loginLocked,
  recordLoginFailure,
  requireCustomerSession,
  SETUP_TOKEN_TTL_MS,
  sha256,
  verifyPassword,
  type CustomerRow,
} from "../auth/customer.js";
import { isSupportedChain } from "../chains.js";
import { db } from "../db/index.js";
import { customerSessions, customers, partners, passwordResetTokens } from "../db/schema.js";
import {
  customerAccountSchema,
  customerIdParamsSchema,
  customerLoginSchema,
  customerPasswordChangeSchema,
  customerSessionResponseSchema,
  customerSetupSchema,
  customerWalletSchema,
  errorResponseSchema,
  okResponseSchema,
  setupLinkResponseSchema,
  toJsonSchema,
} from "../schemas.js";

const err = toJsonSchema(errorResponseSchema);
const sessionSecurity = [{ customerSession: [] }];

async function toAccount(c: CustomerRow) {
  const [partner] = await db.select({ name: partners.name }).from(partners).where(eq(partners.id, c.partnerId)).limit(1);
  return {
    customerId: c.id,
    partnerId: c.partnerId,
    partnerName: partner?.name ?? "",
    externalId: c.externalId,
    email: c.email,
    recipientAddress: c.recipientAddress,
    payoutWallet: c.payoutWallet,
    payoutChainId: c.payoutChainId,
    payoutsEnabled: false,
  };
}

function firstIssue(error: { issues: { message: string; path: PropertyKey[] }[] }): string {
  const issue = error.issues[0];
  if (!issue) return "invalid input";
  const field = issue.path.map(String).join(".");
  return field && !issue.message.includes(field) ? `${field}: ${issue.message}` : issue.message;
}

const isUniqueViolation = (e: unknown, constraint: string) => String(e).includes(constraint) || (e as { cause?: unknown })?.cause?.toString().includes(constraint);

// Body routes use attachValidation: zod in the handler validates (readable
// messages, email trim/lowercase) and the JSON schema documents the shape.
export async function customerAccountRoutes(app: FastifyInstance) {
  // ----- partner side -----
  app.post(
    "/v1/customers/:id/setup-link",
    {
      onRequest: requireApiKey,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["customers"],
        summary: "Create an account setup link token",
        description:
          "Issues a one-time token (valid 72h) that lets this customer set their email and password, or reset a forgotten password. Earlier unused tokens for the customer stop working. There is no email delivery yet: put the token in a link and send it to your customer yourself.",
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(customerIdParamsSchema),
        response: { 201: toJsonSchema(setupLinkResponseSchema), 400: err, 401: err, 403: err, 404: err },
      },
    },
    async (request, reply) => {
      const key = request.apiKey!;
      if (!key.partnerId) return reply.code(400).send({ error: "api key is not linked to a partner" });
      const params = customerIdParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ error: "customer not found" });
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, params.data.id), eq(customers.partnerId, key.partnerId)))
        .limit(1);
      if (!customer) return reply.code(404).send({ error: "customer not found" });

      const { raw, hash } = generateToken("cst_");
      const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS);
      await db.transaction(async (tx) => {
        await tx
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(and(eq(passwordResetTokens.customerId, customer.id), isNull(passwordResetTokens.usedAt)));
        await tx.insert(passwordResetTokens).values({ customerId: customer.id, tokenHash: hash, expiresAt });
      });
      return reply.code(201).send({ customerId: customer.id, token: raw, expiresAt: expiresAt.toISOString() });
    }
  );

  // ----- customer side -----
  app.post(
    "/v1/customer-auth/setup",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      attachValidation: true,
      schema: {
        tags: ["customer-accounts"],
        summary: "Set up (or reset) a customer account",
        description:
          "Uses a one-time setup token from the partner to set the customer's email and password. Signs out every other session and returns a new one.",
        body: {
          ...toJsonSchema(customerSetupSchema),
          example: { token: "cst_…", email: "user@example.com", password: "a long passphrase" },
        },
        response: { 200: toJsonSchema(customerSessionResponseSchema), 400: err, 409: err },
      },
    },
    async (request, reply) => {
      const parsed = customerSetupSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: firstIssue(parsed.error) });
      const { token, email, password } = parsed.data;
      const passwordHash = await hashPassword(password);

      try {
        const result = await db.transaction(async (tx) => {
          // Claim the token atomically so it can only be used once.
          const [claimed] = await tx
            .update(passwordResetTokens)
            .set({ usedAt: new Date() })
            .where(
              and(
                eq(passwordResetTokens.tokenHash, sha256(token)),
                isNull(passwordResetTokens.usedAt),
                gt(passwordResetTokens.expiresAt, new Date())
              )
            )
            .returning({ customerId: passwordResetTokens.customerId });
          if (!claimed) return null;
          const [updated] = await tx
            .update(customers)
            .set({ email, passwordHash })
            .where(eq(customers.id, claimed.customerId))
            .returning();
          await tx.delete(customerSessions).where(eq(customerSessions.customerId, updated.id));
          return updated;
        });
        if (!result) return reply.code(400).send({ error: "this setup link is invalid, expired or already used" });
        const session = await createSession(result.id);
        return reply.send({
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt.toISOString(),
          account: await toAccount(result),
        });
      } catch (e) {
        if (isUniqueViolation(e, "customers_partner_email_unique")) {
          return reply.code(409).send({ error: "this email is already used by another account" });
        }
        throw e;
      }
    }
  );

  app.post(
    "/v1/customer-auth/login",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      attachValidation: true,
      schema: {
        tags: ["customer-accounts"],
        summary: "Customer login",
        description:
          "Email + password login for a partner's customer. After 5 failed attempts for the same account in 15 minutes, further attempts return 429.",
        body: {
          ...toJsonSchema(customerLoginSchema),
          example: { partnerId: "00000000-0000-0000-0000-000000000000", email: "user@example.com", password: "…" },
        },
        response: { 200: toJsonSchema(customerSessionResponseSchema), 400: err, 401: err, 429: err },
      },
    },
    async (request, reply) => {
      const parsed = customerLoginSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: firstIssue(parsed.error) });
      const { partnerId, email, password } = parsed.data;
      if (await loginLocked(request, partnerId, email)) {
        return reply.code(429).send({ error: "too many failed attempts; try again in 15 minutes" });
      }
      const [customer] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.partnerId, partnerId), eq(customers.email, email)))
        .limit(1);
      const ok = await verifyPassword(password, customer?.passwordHash ?? (await dummyPasswordHash()));
      if (!customer?.passwordHash || !ok) {
        await recordLoginFailure(request, partnerId, email);
        return reply.code(401).send({ error: "invalid email or password" });
      }
      await clearLoginFailures(request, partnerId, email);
      const session = await createSession(customer.id);
      return reply.send({
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt.toISOString(),
        account: await toAccount(customer),
      });
    }
  );

  app.post(
    "/v1/customer-auth/logout",
    {
      onRequest: requireCustomerSession,
      schema: {
        tags: ["customer-accounts"],
        summary: "Customer logout",
        security: sessionSecurity,
        response: { 200: toJsonSchema(okResponseSchema), 401: err },
      },
    },
    async (request, reply) => {
      await db.delete(customerSessions).where(eq(customerSessions.id, request.customerSessionId!));
      return reply.send({ ok: true });
    }
  );

  app.get(
    "/v1/customer/me",
    {
      onRequest: requireCustomerSession,
      schema: {
        tags: ["customer-accounts"],
        summary: "Customer account",
        security: sessionSecurity,
        response: { 200: toJsonSchema(customerAccountSchema), 401: err },
      },
    },
    async (request, reply) => reply.send(await toAccount(request.customer!))
  );

  app.post(
    "/v1/customer/me/password",
    {
      onRequest: requireCustomerSession,
      attachValidation: true,
      schema: {
        tags: ["customer-accounts"],
        summary: "Change password",
        description: "Requires the current password. Signs out the customer's other sessions.",
        security: sessionSecurity,
        body: toJsonSchema(customerPasswordChangeSchema),
        response: { 200: toJsonSchema(customerAccountSchema), 400: err, 401: err, 429: err },
      },
    },
    async (request, reply) => {
      const parsed = customerPasswordChangeSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: firstIssue(parsed.error) });
      const customer = request.customer!;
      const email = customer.email ?? customer.id;
      if (await loginLocked(request, customer.partnerId, email)) {
        return reply.code(429).send({ error: "too many failed attempts; try again in 15 minutes" });
      }
      if (!customer.passwordHash || !(await verifyPassword(parsed.data.currentPassword, customer.passwordHash))) {
        await recordLoginFailure(request, customer.partnerId, email);
        return reply.code(400).send({ error: "current password is incorrect" });
      }
      const passwordHash = await hashPassword(parsed.data.newPassword);
      const [updated] = await db.transaction(async (tx) => {
        await tx
          .delete(customerSessions)
          .where(and(eq(customerSessions.customerId, customer.id), ne(customerSessions.id, request.customerSessionId!)));
        return tx.update(customers).set({ passwordHash }).where(eq(customers.id, customer.id)).returning();
      });
      return reply.send(await toAccount(updated));
    }
  );

  app.post(
    "/v1/customer/me/wallet",
    {
      onRequest: requireCustomerSession,
      attachValidation: true,
      schema: {
        tags: ["customer-accounts"],
        summary: "Set payout wallet",
        description:
          "Stores where the customer wants future fee payouts. Payouts are not executed yet (payoutsEnabled is false).",
        security: sessionSecurity,
        body: {
          ...toJsonSchema(customerWalletSchema),
          example: { address: "0x0000000000000000000000000000000000000001", chainId: 5042 },
        },
        response: { 200: toJsonSchema(customerAccountSchema), 400: err, 401: err },
      },
    },
    async (request, reply) => {
      const parsed = customerWalletSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: firstIssue(parsed.error) });
      if (!isSupportedChain(parsed.data.chainId)) return reply.code(400).send({ error: "unsupported chain" });
      const [updated] = await db
        .update(customers)
        .set({ payoutWallet: parsed.data.address, payoutChainId: parsed.data.chainId })
        .where(eq(customers.id, request.customer!.id))
        .returning();
      return reply.send(await toAccount(updated));
    }
  );
}
