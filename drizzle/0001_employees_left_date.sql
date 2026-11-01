ALTER TABLE "employees" ADD COLUMN "left_date" date;--> statement-breakpoint
-- Người đã nghỉ từ trước không có ngày thật: lấy ngày chạy migration để giữ nguyên công cũ
UPDATE "employees" SET "left_date" = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date WHERE "status" = 'left';--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_left_date" CHECK (("employees"."status" = 'left') = ("employees"."left_date" is not null));