import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { intents, quotes } from "./db/schema.js";
import { quoteProvider } from "./providers/index.js";
import type { UpstreamQuote } from "./providers/types.js";

export type IntentRow = typeof intents.$inferSelect;

const TERMINAL = new Set(["EXECUTED_ON_ARC", "FAILED", "REFUNDED"]);

/**
 * Polls the upstream provider for an intent and persists any change.
 * Terminal intents and intents without an upstream id are returned as-is.
 * Throws when the provider can't be reached (callers decide: 502 or keep the stored value).
 */
export async function refreshIntent(row: IntentRow): Promise<IntentRow> {
  if (!row.upstreamId || TERMINAL.has(row.status)) return row;
  // The provider needs the originating quote to map chains for status polling.
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, row.quoteId)).limit(1);
  const detail = await quoteProvider.getStatus(row.upstreamId, quote?.response as unknown as UpstreamQuote | undefined);
  const updates: Partial<IntentRow> = {};
  if (detail.status !== row.status) updates.status = detail.status;
  if (detail.originTx && detail.originTx !== row.originTx) updates.originTx = detail.originTx;
  if (detail.destTx && detail.destTx !== row.destTx) updates.destTx = detail.destTx;
  if (Object.keys(updates).length === 0) return row;
  const [updated] = await db
    .update(intents)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(intents.id, row.id))
    .returning();
  return updated;
}
