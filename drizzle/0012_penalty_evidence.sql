CREATE TABLE "penalty_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"shift_id" uuid NOT NULL,
	"issue" text NOT NULL,
	"by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "penalty_dismissals_issue_unique" UNIQUE("employee_id","date","shift_id","issue")
);
--> statement-breakpoint
ALTER TABLE "penalty_dismissals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN "shift_id" uuid;--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN "issue" text;--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN "evidence" jsonb;--> statement-breakpoint
ALTER TABLE "penalty_dismissals" ADD CONSTRAINT "penalty_dismissals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalty_dismissals" ADD CONSTRAINT "penalty_dismissals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalty_dismissals" ADD CONSTRAINT "penalty_dismissals_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalty_dismissals" ADD CONSTRAINT "penalty_dismissals_by_employees_id_fk" FOREIGN KEY ("by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "penalty_dismissals_company_date_idx" ON "penalty_dismissals" USING btree ("company_id","date");--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "penalties_issue_active_unique" ON "penalties" USING btree ("employee_id","date","shift_id","issue") WHERE "penalties"."issue" is not null and "penalties"."cancelled_at" is null;--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_issue_kind" CHECK ("penalties"."issue" in ('muon', 've_som', 'quen_vao', 'quen_ra'));--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_issue_evidence" CHECK (("penalties"."issue" is null) = ("penalties"."evidence" is null));