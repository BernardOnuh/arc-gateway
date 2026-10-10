/**
 * Verifies a Stableflowr webhook. Pass the RAW request body (not re-serialized
 * JSON), the Stableflowr-Signature header and your endpoint's whsec_ secret. Returns
 * the parsed event, or throws. Works in Node 18+, Deno, Bun and browsers (Web Crypto).
 *
 *   app.post("/hooks/arc", express.raw({ type: "application/json" }), async (req, res) => {
 *     const event = await verifyWebhook(req.body.toString(), req.header("stableflowr-signature"), process.env.ARC_WEBHOOK_SECRET);
 *     if (event.type === "payment.paid") fulfil(event.data.reference);
 *     res.sendStatus(200);
 *   });
 */
export async function verifyWebhook<T = WebhookEvent>(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  toleranceSeconds = 300
): Promise<T> {
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec((signatureHeader ?? "").trim());
  if (!match) throw new Error("missing or malformed Stableflowr-Signature header");
  const [, t, v1] = match;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (age > toleranceSeconds) throw new Error("webhook timestamp outside the allowed window");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Constant-time comparison.
  let diff = expected.length ^ v1.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i % v1.length);
  if (diff !== 0) throw new Error("webhook signature mismatch");
  return JSON.parse(rawBody) as T;
}

/** Webhook body. The unique delivery id is in the stableflowr-delivery-id header (use it to drop duplicates). */
export interface WebhookEvent {
  type: "payment.processing" | "payment.paid" | "payment.partially_paid" | "payment.expired" | "ping";
  created: string;
  data: Record<string, unknown>;
}
