import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "crypto";
import type { FastifyReply, FastifyRequest, onRequestHookHandler } from "fastify";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { customerSessions, customers } from "../db/schema.js";

const scrypt = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)))
  );

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SETUP_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

/** scrypt with a per-password random salt, encoded as scrypt$N$r$p$salt$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = encoded.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Verified against when the account doesn't exist, so response time doesn't reveal which emails are registered.
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Opaque random token with a readable prefix; only its sha256 is stored. */
export function generateToken(prefix: "cs_" | "cst_" | "ps_"): { raw: string; hash: string } {
  const raw = `${prefix}${randomBytes(32).toString("base64url")}`;
  return { raw, hash: sha256(raw) };
}

export async function createSession(customerId: string): Promise<{ sessionToken: string; expiresAt: Date }> {
  const { raw, hash } = generateToken("cs_");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(customerSessions).values({ customerId, tokenHash: hash, expiresAt });
  return { sessionToken: raw, expiresAt };
}

export type CustomerRow = typeof customers.$inferSelect;

export async function authenticateCustomer(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token.startsWith("cs_")) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  const tokenHash = sha256(token);
  const [row] = await db
    .select({ session: customerSessions, customer: customers })
    .from(customerSessions)
    .innerJoin(customers, eq(customers.id, customerSessions.customerId))
    .where(and(eq(customerSessions.tokenHash, tokenHash), gt(customerSessions.expiresAt, new Date())))
    .limit(1);
  if (!row) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  request.customer = row.customer;
  request.customerSessionId = row.session.id;
}

export const requireCustomerSession: onRequestHookHandler = authenticateCustomer;

/**
 * Per-account brute-force guard: after 5 failed logins for the same
 * partner+email in 15 minutes, further attempts get 429 until it expires.
 */
const LOGIN_WINDOW_S = 15 * 60;
const LOGIN_MAX_FAILURES = 5;
const failureKey = (partnerId: string, email: string) => `gateway:cust-login:${partnerId}:${sha256(email)}`;

export async function loginLocked(request: FastifyRequest, partnerId: string, email: string): Promise<boolean> {
  const n = Number(await request.server.redis.get(failureKey(partnerId, email)));
  return n >= LOGIN_MAX_FAILURES;
}

export async function recordLoginFailure(request: FastifyRequest, partnerId: string, email: string) {
  const key = failureKey(partnerId, email);
  const n = await request.server.redis.incr(key);
  if (n === 1) await request.server.redis.expire(key, LOGIN_WINDOW_S);
}

export async function clearLoginFailures(request: FastifyRequest, partnerId: string, email: string) {
  await request.server.redis.del(failureKey(partnerId, email));
}
