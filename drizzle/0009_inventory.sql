CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT 0 NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inventory_report_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"item_id" uuid,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"expected" numeric(12, 2) NOT NULL,
	"counted" numeric(12, 2) NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_report_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inventory_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"punch_in_id" uuid NOT NULL,
	"position_id" uuid,
	"position_name" text NOT NULL,
	"date" date NOT NULL,
	"shift_id" uuid,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "inventory_reports_punch_unique" UNIQUE("punch_in_id")
);
--> statement-breakpoint
ALTER TABLE "inventory_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_report_lines" ADD CONSTRAINT "inventory_report_lines_report_id_inventory_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."inventory_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_report_lines" ADD CONSTRAINT "inventory_report_lines_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reports" ADD CONSTRAINT "inventory_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reports" ADD CONSTRAINT "inventory_reports_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reports" ADD CONSTRAINT "inventory_reports_punch_in_id_attendance_logs_id_fk" FOREIGN KEY ("punch_in_id") REFERENCES "public"."attendance_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reports" ADD CONSTRAINT "inventory_reports_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reports" ADD CONSTRAINT "inventory_reports_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reports" ADD CONSTRAINT "inventory_reports_decided_by_employees_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_items_position_idx" ON "inventory_items" USING btree ("company_id","position_id");--> statement-breakpoint
CREATE INDEX "inventory_report_lines_report_idx" ON "inventory_report_lines" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "inventory_reports_company_status_idx" ON "inventory_reports" USING btree ("company_id","status","date");--> statement-breakpoint
CREATE INDEX "inventory_reports_employee_idx" ON "inventory_reports" USING btree ("employee_id","created_at");