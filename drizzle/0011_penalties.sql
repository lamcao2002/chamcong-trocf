CREATE TABLE "penalties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"rule_id" uuid,
	"rule_name" text NOT NULL,
	"date" date NOT NULL,
	"period_key" text NOT NULL,
	"scars" integer DEFAULT 0 NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"note" text NOT NULL,
	"by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancel_reason" text,
	CONSTRAINT "penalties_value" CHECK ("penalties"."scars" >= 0 and "penalties"."amount" >= 0 and ("penalties"."scars" > 0 or "penalties"."amount" > 0))
);
--> statement-breakpoint
ALTER TABLE "penalties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "penalty_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"scars" integer DEFAULT 0 NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"note" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "penalty_rules_value" CHECK ("penalty_rules"."scars" >= 0 and "penalty_rules"."amount" >= 0 and ("penalty_rules"."scars" > 0 or "penalty_rules"."amount" > 0))
);
--> statement-breakpoint
ALTER TABLE "penalty_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "scar_threshold" integer;--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_rule_id_penalty_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."penalty_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_by_employees_id_fk" FOREIGN KEY ("by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_cancelled_by_employees_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalty_rules" ADD CONSTRAINT "penalty_rules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "penalties_company_period_idx" ON "penalties" USING btree ("company_id","period_key");--> statement-breakpoint
CREATE INDEX "penalties_employee_period_idx" ON "penalties" USING btree ("employee_id","period_key");--> statement-breakpoint
CREATE INDEX "penalty_rules_company_idx" ON "penalty_rules" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_scar_threshold_range" CHECK ("companies"."scar_threshold" between 1 and 99);