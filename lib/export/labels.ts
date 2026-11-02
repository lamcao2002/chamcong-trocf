import type { PayrollDocument } from '@/lib/services/payroll';

export const STATE_LABELS: Record<PayrollDocument['state'], string> = {
  draft: 'Tạm tính, chưa công bố',
  published: 'Đã công bố',
  stale: 'Bản đã công bố, số liệu đã đổi sau đó',
};
