ALTER TABLE "companies" ADD COLUMN "device_binding" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "device_hash" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "device_bound_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_device_unique" UNIQUE("company_id","device_hash");