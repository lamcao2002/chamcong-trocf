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
});

export const companyPatchSchema = companySchema.partial();

export type CompanyInput = z.infer<typeof companySchema>;
