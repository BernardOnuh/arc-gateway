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

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    feeBps: integer("fee_bps").notNull(),
    rateLimitPerMin: integer("rate_limit_per_min").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("partners_email_unique").on(table.email),
  })
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    recipientAddress: text("recipient_address").notNull(),
    /** Customer self-service account (set via a partner-issued setup link). Lowercased. */
    email: text("email"),
    /** scrypt$N$r$p$salt$hash; null until the customer sets a password. */
    passwordHash: text("password_hash"),
    /** Where future fee payouts go. Stored only; payouts are not executed yet. */
    payoutWallet: text("payout_wallet"),
    payoutChainId: integer("payout_chain_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    partnerExternalUnique: uniqueIndex("customers_partner_external_unique").on(
      table.partnerId,
      table.externalId
    ),
    partnerEmailUnique: uniqueIndex("customers_partner_email_unique").on(table.partnerId, table.email),
  })
);

export const customerSessions = pgTable("customer_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** One-time setup/reset links. No email delivery yet: the partner hands the link over. */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "cascade" }),
    partnerName: text("partner_name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    feeBps: integer("fee_bps").notNull(),
    rateLimitPerMin: integer("rate_limit_per_min").notNull(),
    active: boolean("active").notNull().default(true),
    /** "secret" (gw_live_, server-side) or "publishable" (pk_live_, browser widget). */
    kind: text("kind").$type<"secret" | "publishable">().notNull().default("secret"),
    /** Last 4 characters of the raw key, to tell keys apart in the dashboard. */
    last4: text("last4"),
    /** Publishable keys only: the raw key (it is public by design) and the browser origins allowed to use it. */
    publicKey: text("public_key"),
    allowedOrigins: jsonb("allowed_origins").$type<string[]>(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    keyHashUnique: uniqueIndex("api_keys_key_hash_unique").on(table.keyHash),
  })
);

/**
 * Dashboard sessions: the partner trades their secret key for an httpOnly
 * cookie once, so the key never sits in browser storage. A session acts as
 * the key it was opened with and dies with it (revoke); rotate moves it to the new key.
 */
export const partnerSessions = pgTable("partner_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .references(() => apiKeys.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .references(() => apiKeys.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
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
}, (table) => ({
  quoteIdUnique: uniqueIndex("intents_quote_id_unique").on(table.quoteId),
}));

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
