import { and, isNotNull, lt, or } from "drizzle-orm";
import { db } from "./db/index.js";
import { customerSessions, partnerPasswordResets, partnerSessions, passwordResetTokens } from "./db/schema.js";

const DAY = 24 * 60 * 60 * 1000;

/** Deletes expired sessions and stale one-time tokens. Returns rows removed. */
export async function cleanupExpired(now = new Date()): Promise<number> {
  const results = await Promise.all([
    db.delete(partnerSessions).where(lt(partnerSessions.expiresAt, now)).returning({ id: partnerSessions.id }),
    db.delete(customerSessions).where(lt(customerSessions.expiresAt, now)).returning({ id: customerSessions.id }),
    db
      .delete(partnerPasswordResets)
      .where(or(lt(partnerPasswordResets.expiresAt, now), and(isNotNull(partnerPasswordResets.usedAt), lt(partnerPasswordResets.usedAt, new Date(now.getTime() - DAY)))))
      .returning({ id: partnerPasswordResets.id }),
    db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date(now.getTime() - 7 * DAY))).returning({ id: passwordResetTokens.id }),
  ]);
  return results.reduce((n, r) => n + r.length, 0);
}
