import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { apiKeys, partnerSessions } from "./db/schema.js";
import { generateApiKey } from "./auth/apiKey.js";
import { cleanupExpired } from "./cleanup.js";

describe("cleanupExpired", () => {
  it("removes expired sessions and keeps live ones", async () => {
    const k = generateApiKey();
    const [key] = await db
      .insert(apiKeys)
      .values({ partnerName: "cleanup", keyPrefix: k.keyPrefix, keyHash: k.keyHash, feeBps: 10, rateLimitPerMin: 10, active: true })
      .returning();
    const [old] = await db.insert(partnerSessions).values({ apiKeyId: key.id, tokenHash: `old-${k.keyHash}`, expiresAt: new Date(Date.now() - 1000) }).returning();
    const [live] = await db.insert(partnerSessions).values({ apiKeyId: key.id, tokenHash: `live-${k.keyHash}`, expiresAt: new Date(Date.now() + 60_000) }).returning();
    expect(await cleanupExpired()).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(partnerSessions).where(eq(partnerSessions.id, old.id))).toHaveLength(0);
    expect(await db.select().from(partnerSessions).where(eq(partnerSessions.id, live.id))).toHaveLength(1);
  });
});
