import { createHmac, randomBytes } from "crypto";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { config } from "./config.js";
import { db } from "./db/index.js";
import { partnerWebhooks, webhookEvents } from "./db/schema.js";

export type WebhookEventType =
  | "payment.processing"
  | "payment.paid"
  | "payment.partially_paid"
  | "payment.expired"
  | "ping";

/** Delay before attempt n+1 (attempt 1 is immediate). 8 attempts over ~2 days. */
const BACKOFF_S = [30, 120, 600, 1800, 7200, 21600, 43200, 86400];
export const MAX_ATTEMPTS = BACKOFF_S.length;
const TIMEOUT_MS = 10_000;

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/** `Stableflowr-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>` */
export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:|.*\.local$|.*\.internal$)/i;

/**
 * Endpoint URLs must be https on public hosts in production (no internal
 * addresses: SSRF guard). Development also allows http and localhost.
 */
export function webhookUrlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "url must be a valid URL";
  }
  if (url.username || url.password) return "url must not contain credentials";
  if (!config.isProduction) return url.protocol === "https:" || url.protocol === "http:" ? null : "url must be http(s)";
  if (url.protocol !== "https:") return "url must use https";
  if (PRIVATE_HOST.test(url.hostname)) return "url must be a public host";
  return null;
}

/** Queue an event for every active endpoint of the partner. Safe inside a transaction. */
export async function enqueueEvent(
  tx: Pick<typeof db, "select" | "insert">,
  partnerId: string,
  type: WebhookEventType,
  data: Record<string, unknown>,
  paymentId: string | null
): Promise<number> {
  const hooks = await tx
    .select({ id: partnerWebhooks.id })
    .from(partnerWebhooks)
    .where(and(eq(partnerWebhooks.partnerId, partnerId), eq(partnerWebhooks.active, true)));
  if (hooks.length === 0) return 0;
  const created = new Date().toISOString();
  await tx.insert(webhookEvents).values(
    hooks.map((h) => ({
      webhookId: h.id,
      paymentId,
      type,
      payload: { type, created, data },
    }))
  );
  return hooks.length;
}

type EventRow = typeof webhookEvents.$inferSelect;

/** One HTTP attempt; records the outcome and schedules a retry on failure. */
export async function attemptDelivery(event: EventRow): Promise<EventRow> {
  const [hook] = await db.select().from(partnerWebhooks).where(eq(partnerWebhooks.id, event.webhookId)).limit(1);
  const attempts = event.attempts + 1;
  if (!hook || !hook.active) {
    const [row] = await db
      .update(webhookEvents)
      .set({ status: "failed", attempts, lastError: "endpoint removed" })
      .where(eq(webhookEvents.id, event.id))
      .returning();
    return row;
  }
  const body = JSON.stringify({ id: event.id, ...(event.payload as object) });
  let statusCode: number | null = null;
  let error: string | null = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "user-agent": "Stableflowr-Webhooks/1.0",
        "stableflowr-event": event.type,
        "stableflowr-delivery-id": event.id,
        "stableflowr-signature": signPayload(hook.secret, body),
      },
      body,
    });
    statusCode = res.status;
    if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
  } catch (e) {
    error = controller.signal.aborted ? "timed out after 10s" : String((e as Error).message ?? e).slice(0, 200);
  } finally {
    clearTimeout(timer);
  }

  const succeeded = error === null;
  const exhausted = attempts >= MAX_ATTEMPTS;
  const [row] = await db
    .update(webhookEvents)
    .set({
      attempts,
      lastStatusCode: statusCode,
      lastError: error,
      status: succeeded ? "succeeded" : exhausted ? "failed" : "pending",
      deliveredAt: succeeded ? new Date() : null,
      nextAttemptAt: succeeded || exhausted ? new Date() : new Date(Date.now() + BACKOFF_S[attempts - 1] * 1000),
    })
    .where(eq(webhookEvents.id, event.id))
    .returning();
  return row;
}

/**
 * Claims due events (skipping ones another instance holds) and delivers them,
 * oldest first and one at a time per endpoint so each endpoint sees events in order.
 * Claiming pushes nextAttemptAt out, so a crash mid-send just retries later.
 */
export async function deliverDue(limit = 20): Promise<number> {
  const claimed = await db
    .update(webhookEvents)
    .set({ nextAttemptAt: sql`now() + interval '2 minutes'` })
    .where(
      inArray(
        webhookEvents.id,
        db
          .select({ id: webhookEvents.id })
          .from(webhookEvents)
          .where(and(eq(webhookEvents.status, "pending"), lte(webhookEvents.nextAttemptAt, sql`now()`)))
          .orderBy(asc(webhookEvents.createdAt))
          .limit(limit)
          .for("update", { skipLocked: true })
      )
    )
    .returning();
  // In order per endpoint (processing before paid), endpoints in parallel.
  const byHook = new Map<string, EventRow[]>();
  for (const e of claimed.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    byHook.set(e.webhookId, [...(byHook.get(e.webhookId) ?? []), e]);
  }
  await Promise.all(
    [...byHook.values()].map(async (events) => {
      for (const e of events) await attemptDelivery(e);
    })
  );
  return claimed.length;
}
