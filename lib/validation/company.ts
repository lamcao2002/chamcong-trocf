import { z } from 'zod';
import { optionalText, requiredText, workDays } from './common';

export const companySchema = z.object({
  name: requiredText(),
  address: optionalText(),
  appName: optionalText(80),
  workDays,
  graceMode: z.enum(['toan_bo', 'phan_vuot']),
  otBefore: z.boolean(),
  otMin: z.number().int().min(0).max(600),
  otFromRequest: z.boolean(),
  /** null = kỳ lương tròn tháng. */
  cutoffDay: z.number().int().min(1).max(31).nullable(),
  deviceBinding: z.boolean(),
});

export const companyPatchSchema = companySchema.partial();

export type CompanyInput = z.infer<typeof companySchema>;

/** Đầu vào của `npm run company:create`; mã đi vào link cài app nên chỉ gồm chữ và số. */
export const companyCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{3,20}$/, 'Mã gồm 3–20 chữ cái hoặc số')),
  name: requiredText(),
  adminName: requiredText(),
  adminEmail: z.string().trim().toLowerCase().email('Email không hợp lệ'),
});
