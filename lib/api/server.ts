import 'server-only';
import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';
import { fieldErrors } from '@/lib/validation/common';
import { ApiError, notFound } from './errors';

export type IdRoute = { params: Promise<{ id: string }> };

export function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

/** Đọc và kiểm tra body JSON; sai thì trả 400 kèm lỗi theo trường. */
export async function parseBody<T extends ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data as z.output<T>;

  const fields = fieldErrors(parsed.error);
  throw new ApiError(400, Object.values(fields)[0] ?? 'Dữ liệu gửi lên không hợp lệ', fields);
}

/** ID trên URL; sai định dạng coi như không tồn tại, tránh lỗi kiểu uuid từ PostgreSQL. */
export async function routeId(route: IdRoute, what: string): Promise<string> {
  const { id } = await route.params;
  if (!z.string().uuid().safeParse(id).success) throw notFound(what);
  return id;
}

/** Drizzle bọc lỗi của driver trong `cause`. */
export function isUniqueViolation(error: unknown): boolean {
  const code = (value: unknown) => (value as { code?: string } | undefined)?.code;
  return code(error) === '23505' || code((error as { cause?: unknown } | undefined)?.cause) === '23505';
}
