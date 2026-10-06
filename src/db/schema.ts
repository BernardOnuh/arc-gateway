import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerName: text("partner_name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    feeBps: integer("fee_bps").notNull(),
    rateLimitPerMin: integer("rate_limit_per_min").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    keyHashUnique: uniqueIndex("api_keys_key_hash_unique").on(table.keyHash),
  })
);

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .references(() => apiKeys.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  upstreamQuoteId: text("upstream_quote_id"),
  request: jsonb("request").notNull(),
  response: jsonb("response"),
  amountIn: numeric("amount_in").notNull(),
  feeAmount: numeric("fee_amount").notNull(),
  feeBps: integer("fee_bps").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const intentStatusEnum = pgEnum("intent_status", [
  "PENDING",
  "ORIGIN_CONFIRMED",
  "FILLED",
  "EXECUTED_ON_ARC",
  "REFUNDED",
  "FAILED",
]);

export const intents = pgTable("intents", {
  id: uuid("id").primaryKey().defaultRandom(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .references(() => apiKeys.id, { onDelete: "cascade" }),
  status: intentStatusEnum("status").notNull().default("PENDING"),
  originTx: text("origin_tx"),
  destTx: text("dest_tx"),
  upstreamId: text("upstream_id"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .references(() => apiKeys.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secretHash: text("secret_hash").notNull(),
  active: boolean("active").notNull().default(true),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpointId: uuid("endpoint_id")
    .notNull()
    .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  intentId: uuid("intent_id")
    .notNull()
    .references(() => intents.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: jsonb("payload"),
  attempts: integer("attempts").notNull().default(0),
  status: text("status").notNull().default("pending"),
  nextAttemptAt: timestamp("next_attempt_at"),
  lastError: text("last_error"),
});
