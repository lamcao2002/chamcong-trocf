CREATE TABLE "employee_positions" (
	"employee_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	CONSTRAINT "employee_positions_employee_id_position_id_pk" PRIMARY KEY("employee_id","position_id")
);
--> statement-breakpoint
ALTER TABLE "employee_positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "schedule_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"shift_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"is_off" boolean DEFAULT false NOT NULL,
	"positions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"registration_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_drafts_employee_date_unique" UNIQUE("employee_id","date")
);
--> statement-breakpoint
ALTER TABLE "schedule_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "schedule_cells" ADD COLUMN "positions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_positions" ADD CONSTRAINT "employee_positions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_drafts" ADD CONSTRAINT "schedule_drafts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_drafts" ADD CONSTRAINT "schedule_drafts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedule_drafts_company_date_idx" ON "schedule_drafts" USING btree ("company_id","date");