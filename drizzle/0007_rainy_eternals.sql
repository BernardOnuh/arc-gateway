CREATE TYPE "public"."payment_status" AS ENUM('open', 'processing', 'paid', 'partially_paid', 'expired', 'canceled');--> statement-breakpoint
CREATE TABLE "payment_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"intent_id" uuid,
	"payer" text NOT NULL,
	"value_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"customer_id" uuid,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text,
	"reference" text,
	"payout_address" text NOT NULL,
	"dest_chain_id" integer NOT NULL,
	"status" "payment_status" DEFAULT 'open' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "payout_address" text;--> statement-breakpoint
ALTER TABLE "payment_legs" ADD CONSTRAINT "payment_legs_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_legs" ADD CONSTRAINT "payment_legs_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_legs" ADD CONSTRAINT "payment_legs_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_legs_quote_unique" ON "payment_legs" USING btree ("quote_id");