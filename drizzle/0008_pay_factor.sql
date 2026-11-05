ALTER TABLE "approvals" ADD COLUMN "pay_factor" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "day_records" ADD COLUMN "pay_factor" numeric(4, 2) DEFAULT 1 NOT NULL;