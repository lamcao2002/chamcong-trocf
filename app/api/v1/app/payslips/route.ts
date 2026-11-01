import { ok } from '@/lib/api/server';
import { withAuth } from '@/lib/auth/guard';
import { listMyPayslips } from '@/lib/services/payroll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/app/payslips — các kỳ đã công bố của tôi (US36). */
export const GET = withAuth({ kind: 'app' }, async (ctx) => ok({ payslips: await listMyPayslips(ctx) }));
