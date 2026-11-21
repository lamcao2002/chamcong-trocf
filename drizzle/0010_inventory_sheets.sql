CREATE TYPE "public"."inventory_kind" AS ENUM('vat_dung', 'nguyen_lieu');--> statement-breakpoint
CREATE TABLE "inventory_sheet_items" (
	"sheet_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "inventory_sheet_items_sheet_id_item_id_pk" PRIMARY KEY("sheet_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "inventory_sheet_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inventory_sheet_positions" (
	"sheet_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	CONSTRAINT "inventory_sheet_positions_sheet_id_position_id_pk" PRIMARY KEY("sheet_id","position_id")
);
--> statement-breakpoint
ALTER TABLE "inventory_sheet_positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inventory_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_sheets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_reports" DROP CONSTRAINT "inventory_reports_punch_unique";--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "position_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "kind" "inventory_kind" DEFAULT 'vat_dung' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_report_lines" ADD COLUMN "kind" "inventory_kind" DEFAULT 'vat_dung' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_reports" ADD COLUMN "sheet_id" uuid;--> statement-breakpoint
-- Thêm cột trống trước, điền từ dữ liệu cũ rồi mới đặt NOT NULL ở cuối file
ALTER TABLE "inventory_reports" ADD COLUMN "sheet_name" text;--> statement-breakpoint
ALTER TABLE "inventory_sheet_items" ADD CONSTRAINT "inventory_sheet_items_sheet_id_inventory_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."inventory_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_sheet_items" ADD CONSTRAINT "inventory_sheet_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_sheet_positions" ADD CONSTRAINT "inventory_sheet_positions_sheet_id_inventory_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."inventory_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_sheet_positions" ADD CONSTRAINT "inventory_sheet_positions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_sheets" ADD CONSTRAINT "inventory_sheets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_sheets_company_idx" ON "inventory_sheets" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "inventory_reports" ADD CONSTRAINT "inventory_reports_sheet_id_inventory_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."inventory_sheets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reports" ADD CONSTRAINT "inventory_reports_punch_sheet_unique" UNIQUE("punch_in_id","sheet_id");--> statement-breakpoint
-- Bản 0009 mỗi vị trí một danh sách: mỗi vị trí có món thành một phiếu "Kiểm kê <vị trí>" dành cho vị trí đó
WITH src AS (
	SELECT gen_random_uuid() AS sheet_id, p.id AS position_id, p.company_id, p.name
	FROM "positions" p
	WHERE EXISTS (SELECT 1 FROM "inventory_items" i WHERE i.position_id = p.id)
), sheets AS (
	INSERT INTO "inventory_sheets" ("id", "company_id", "name")
	SELECT sheet_id, company_id, 'Kiểm kê ' || name FROM src
), links AS (
	INSERT INTO "inventory_sheet_positions" ("sheet_id", "position_id")
	SELECT sheet_id, position_id FROM src
)
INSERT INTO "inventory_sheet_items" ("sheet_id", "item_id", "sort_order")
SELECT src.sheet_id, i.id, i.sort_order FROM src JOIN "inventory_items" i ON i.position_id = src.position_id;--> statement-breakpoint
-- Lúc này mỗi phiếu chỉ có đúng một vị trí nên gắn báo cáo cũ theo vị trí là đúng phiếu
UPDATE "inventory_reports" r SET "sheet_id" = sp.sheet_id, "sheet_name" = s.name
FROM "inventory_sheet_positions" sp JOIN "inventory_sheets" s ON s.id = sp.sheet_id
WHERE sp.position_id = r.position_id;--> statement-breakpoint
UPDATE "inventory_reports" SET "sheet_name" = 'Kiểm kê ' || "position_name" WHERE "sheet_name" IS NULL;--> statement-breakpoint
ALTER TABLE "inventory_reports" ALTER COLUMN "sheet_name" SET NOT NULL;--> statement-breakpoint
-- Món thành danh mục chung của quán
UPDATE "inventory_items" SET "position_id" = NULL;
