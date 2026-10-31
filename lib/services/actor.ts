import type { Actor } from '@/lib/audit';
import type { AuthContext } from '@/lib/auth/policy';

export function actorOf(ctx: AuthContext): Actor {
  return { companyId: ctx.company.id, actorId: ctx.employee.id };
}
