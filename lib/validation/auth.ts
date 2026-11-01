import { z } from 'zod';

/** Dữ liệu đăng nhập, dùng chung cho form A1, M1 và API. */
export const loginSchema = z.object({
  companyCode: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toUpperCase()),
  email: z.string().trim().toLowerCase().email(),
  pin: z.string().regex(/^\d{4,8}$/),
});

export type LoginInput = z.infer<typeof loginSchema>;
