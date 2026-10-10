ALTER TABLE "api_keys" ADD COLUMN "kind" text DEFAULT 'secret' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last4" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "public_key" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "allowed_origins" jsonb;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "revoked_at" timestamp;