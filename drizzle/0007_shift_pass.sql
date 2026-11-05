ALTER TYPE "public"."request_type" ADD VALUE 'shift_pass';--> statement-breakpoint
CREATE TABLE "position_covers" (
	"position_id" uuid NOT NULL,
	"covers_id" uuid NOT NULL,
	CONSTRAINT "position_covers_position_id_covers_id_pk" PRIMARY KEY("position_id","covers_id")
);
--> statement-breakpoint
ALTER TABLE "position_covers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "target_employee_id" uuid;--> statement-breakpoint
ALTER TABLE "position_covers" ADD CONSTRAINT "position_covers_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_covers" ADD CONSTRAINT "position_covers_covers_id_positions_id_fk" FOREIGN KEY ("covers_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_target_employee_id_employees_id_fk" FOREIGN KEY ("target_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;