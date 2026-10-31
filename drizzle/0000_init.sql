CREATE TYPE "public"."adjustment_kind" AS ENUM('bonus', 'penalty');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('full_time', 'part_time', 'intern', 'collaborator');--> statement-breakpoint
CREATE TYPE "public"."day_status" AS ENUM('chua_toi', 'dang_lam', 'vang', 'thieu_gio', 'sai_ca', 'ngoai_vung', 'ngoai_lich', 'ot_cho', 'muon', 'nua_cong', 'du', 'nghi_phep', 'le', 'nghi');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'left');--> statement-breakpoint
CREATE TYPE "public"."grace_mode" AS ENUM('toan_bo', 'phan_vuot');--> statement-breakpoint
CREATE TYPE "public"."ot_state" AS ENUM('none', 'cho_duyet', 'da_duyet');--> statement-breakpoint
CREATE TYPE "public"."pay_type" AS ENUM('month', 'hour', 'unit');--> statement-breakpoint
CREATE TYPE "public"."punch_type" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('leave', 'forgot', 'overtime');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('app', 'manager', 'hr', 'admin');--> statement-breakpoint
CREATE TYPE "public"."session_kind" AS ENUM('admin', 'app');--> statement-breakpoint
CREATE TYPE "public"."shift_calc" AS ENUM('block', 'actual', 'actual_strict');--> statement-breakpoint
CREATE TYPE "public"."shift_mode" AS ENUM('fixed', 'flexible');--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" "adjustment_kind" NOT NULL,
	"amount" bigint NOT NULL,
	"note" text NOT NULL,
	"by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "adjustments_amount_positive" CHECK ("adjustments"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"shift_id" uuid,
	"cong_override" numeric(4, 2),
	"ot_minutes" integer,
	"approve_missing" boolean DEFAULT false NOT NULL,
	"waive_late" boolean DEFAULT false NOT NULL,
	"waive_early" boolean DEFAULT false NOT NULL,
	"confirm_shift_id" uuid,
	"approve_gps" boolean DEFAULT false NOT NULL,
	"note" text,
	"by" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attendance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"type" "punch_type" NOT NULL,
	"chosen_shift_id" uuid,
	"lat" double precision,
	"lng" double precision,
	"accuracy_m" double precision,
	"in_zone" boolean,
	"distance_m" double precision,
	"location_id" uuid,
	"synthetic" boolean DEFAULT false NOT NULL,
	"source_request_id" uuid
);
--> statement-breakpoint
ALTER TABLE "attendance_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"app_name" text,
	"brand_color" text,
	"work_days" integer[] DEFAULT '{0,1,2,3,4,5,6}'::integer[] NOT NULL,
	"grace_mode" "grace_mode" DEFAULT 'toan_bo' NOT NULL,
	"ot_before" boolean DEFAULT false NOT NULL,
	"ot_min" integer DEFAULT 30 NOT NULL,
	"ot_from_request" boolean DEFAULT true NOT NULL,
	"cutoff_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_code_unique" UNIQUE("code"),
	CONSTRAINT "companies_cutoff_day_range" CHECK ("companies"."cutoff_day" between 1 and 31)
);
--> statement-breakpoint
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "day_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"shift_id" uuid,
	"status" "day_status" NOT NULL,
	"in_at" timestamp with time zone,
	"out_at" timestamp with time zone,
	"worked_min" integer DEFAULT 0 NOT NULL,
	"cong" numeric(4, 2) DEFAULT 0 NOT NULL,
	"expected_cong" numeric(4, 2) DEFAULT 0 NOT NULL,
	"late_min" integer DEFAULT 0 NOT NULL,
	"early_min" integer DEFAULT 0 NOT NULL,
	"waived_late" boolean DEFAULT false NOT NULL,
	"waived_early" boolean DEFAULT false NOT NULL,
	"ot_proposed" integer DEFAULT 0 NOT NULL,
	"ot_approved" integer DEFAULT 0 NOT NULL,
	"ot_state" "ot_state" DEFAULT 'none' NOT NULL,
	"missing" integer DEFAULT 0 NOT NULL,
	"off_day" boolean DEFAULT false NOT NULL,
	"is_holiday" boolean DEFAULT false NOT NULL,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"suggestion" jsonb,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_records_employee_date_shift_unique" UNIQUE NULLS NOT DISTINCT("employee_id","date","shift_id")
);
--> statement-breakpoint
ALTER TABLE "day_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_locations" (
	"employee_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "employee_locations_employee_id_location_id_pk" PRIMARY KEY("employee_id","location_id")
);
--> statement-breakpoint
ALTER TABLE "employee_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_shifts" (
	"employee_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	CONSTRAINT "employee_shifts_employee_id_shift_id_pk" PRIMARY KEY("employee_id","shift_id")
);
--> statement-breakpoint
ALTER TABLE "employee_shifts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"pin_hash" text NOT NULL,
	"failed_pin_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"contract" "contract_type" DEFAULT 'full_time' NOT NULL,
	"onboard_date" date NOT NULL,
	"role" "role" DEFAULT 'app' NOT NULL,
	"manager_id" uuid,
	"position_id" uuid,
	"pay_override" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_company_email_unique" UNIQUE("company_id","email"),
	CONSTRAINT "employees_email_lowercase" CHECK ("employees"."email" = lower("employees"."email"))
);
--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "explanations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"shift_id" uuid,
	"reason" text NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explanations_employee_date_shift_unique" UNIQUE NULLS NOT DISTINCT("employee_id","date","shift_id")
);
--> statement-breakpoint
ALTER TABLE "explanations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "holidays_company_date_unique" UNIQUE("company_id","date")
);
--> statement-breakpoint
ALTER TABLE "holidays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"radius_m" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_radius_range" CHECK ("locations"."radius_m" between 30 and 500)
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"stale" boolean DEFAULT false NOT NULL,
	CONSTRAINT "payroll_periods_company_key_unique" UNIQUE("company_id","period_key")
);
--> statement-breakpoint
ALTER TABLE "payroll_periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"net" bigint NOT NULL,
	"lines" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payslips_period_employee_unique" UNIQUE("period_id","employee_id")
);
--> statement-breakpoint
ALTER TABLE "payslips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "position_locations" (
	"position_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "position_locations_position_id_location_id_pk" PRIMARY KEY("position_id","location_id")
);
--> statement-breakpoint
ALTER TABLE "position_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "position_shifts" (
	"position_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	CONSTRAINT "position_shifts_position_id_shift_id_pk" PRIMARY KEY("position_id","shift_id")
);
--> statement-breakpoint
ALTER TABLE "position_shifts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"shift_mode" "shift_mode" NOT NULL,
	"fixed_shift_id" uuid,
	"work_days" integer[] DEFAULT '{0,1,2,3,4,5,6}'::integer[] NOT NULL,
	"any_location" boolean DEFAULT false NOT NULL,
	"pay_type" "pay_type" NOT NULL,
	"pay_amount" bigint NOT NULL,
	"std_days" integer DEFAULT 26 NOT NULL,
	"leave_days" integer DEFAULT 12 NOT NULL,
	"ot_weekday" integer DEFAULT 150 NOT NULL,
	"ot_saturday" integer,
	"ot_offday" integer DEFAULT 200 NOT NULL,
	"ot_holiday" integer DEFAULT 300 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_fixed_shift" CHECK (("positions"."shift_mode" = 'fixed') = ("positions"."fixed_shift_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" "request_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason" text,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"reject_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "schedule_cells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"shift_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"is_off" boolean DEFAULT false NOT NULL,
	CONSTRAINT "schedule_cells_employee_date_unique" UNIQUE("employee_id","date")
);
--> statement-breakpoint
ALTER TABLE "schedule_cells" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"kind" "session_kind" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"break_start" time,
	"break_end" time,
	"overnight" boolean DEFAULT false NOT NULL,
	"calc" "shift_calc" DEFAULT 'block' NOT NULL,
	"std_hours" numeric(4, 2) NOT NULL,
	"min_full" integer NOT NULL,
	"min_half" integer NOT NULL,
	"grace_min" integer DEFAULT 0 NOT NULL,
	"min_ot" integer,
	"is_part" boolean DEFAULT false NOT NULL,
	"no_late_check" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shifts_company_code_unique" UNIQUE("company_id","code"),
	CONSTRAINT "shifts_min_half_le_full" CHECK ("shifts"."min_half" <= "shifts"."min_full")
);
--> statement-breakpoint
ALTER TABLE "shifts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_by_employees_id_fk" FOREIGN KEY ("by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_confirm_shift_id_shifts_id_fk" FOREIGN KEY ("confirm_shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_by_employees_id_fk" FOREIGN KEY ("by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_chosen_shift_id_shifts_id_fk" FOREIGN KEY ("chosen_shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_source_request_id_requests_id_fk" FOREIGN KEY ("source_request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_employees_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_records" ADD CONSTRAINT "day_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_records" ADD CONSTRAINT "day_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_records" ADD CONSTRAINT "day_records_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_locations" ADD CONSTRAINT "employee_locations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_locations" ADD CONSTRAINT "employee_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_employees_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanations" ADD CONSTRAINT "explanations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanations" ADD CONSTRAINT "explanations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanations" ADD CONSTRAINT "explanations_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_published_by_employees_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_period_id_payroll_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_locations" ADD CONSTRAINT "position_locations_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_locations" ADD CONSTRAINT "position_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_shifts" ADD CONSTRAINT "position_shifts_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_shifts" ADD CONSTRAINT "position_shifts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_fixed_shift_id_shifts_id_fk" FOREIGN KEY ("fixed_shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_decided_by_employees_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_cells" ADD CONSTRAINT "schedule_cells_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_cells" ADD CONSTRAINT "schedule_cells_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adjustments_company_period_idx" ON "adjustments" USING btree ("company_id","period_key");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_active_unique" ON "approvals" USING btree ("employee_id","date",coalesce("shift_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "approvals"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "attendance_logs_employee_at_idx" ON "attendance_logs" USING btree ("employee_id","at");--> statement-breakpoint
CREATE INDEX "attendance_logs_company_at_idx" ON "attendance_logs" USING btree ("company_id","at");--> statement-breakpoint
CREATE INDEX "audit_logs_company_at_idx" ON "audit_logs" USING btree ("company_id","at");--> statement-breakpoint
CREATE INDEX "day_records_company_date_idx" ON "day_records" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "employees_manager_idx" ON "employees" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "locations_company_idx" ON "locations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "positions_company_idx" ON "positions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "requests_company_status_idx" ON "requests" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "requests_employee_from_idx" ON "requests" USING btree ("employee_id","from_date");--> statement-breakpoint
CREATE INDEX "schedule_cells_company_date_idx" ON "schedule_cells" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "sessions_employee_idx" ON "sessions" USING btree ("employee_id");