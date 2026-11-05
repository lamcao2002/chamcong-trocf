import { formatDate, formatDecimal } from '@/lib/format';

const LEAVE_LABELS: Record<string, string> = {
  annual: 'Phép năm',
  sick: 'Nghỉ ốm',
  unpaid: 'Không lương',
};

type ShiftName = (id: unknown) => string | null;

/** Một dòng mô tả đơn, dùng chung cho Hộp việc, Đơn của tôi và thông báo. */
export function requestSummary(type: string, payload: Record<string, unknown>, shiftName: ShiftName): string {
  if (type === 'leave')
    return `Nghỉ phép · ${LEAVE_LABELS[String(payload.leaveType)] ?? ''} · ${formatDecimal(Number(payload.days))} ngày`;
  if (type === 'forgot')
    return `Quên chấm · vào ${String(payload.inTime ?? '—')}, ra ${String(payload.outTime ?? '—')}`;
  if (type === 'late_early') {
    const what = payload.kind === 'late' ? 'đi trễ' : 'về sớm';
    return `Xin ${what} ${String(payload.minutes)} phút · ${shiftName(payload.shiftId) ?? 'Cả ngày'}`;
  }
  if (type === 'shift_swap') {
    const off = `${shiftName(payload.offShiftId) ?? ''} ${formatDate(String(payload.offDate)).slice(0, 5)}`;
    const work = `${shiftName(payload.workShiftId) ?? ''} ${formatDate(String(payload.workDate)).slice(0, 5)}`;
    return `Đổi ca · nghỉ ${off}, làm bù ${work}`;
  }
  if (type === 'shift_register') return `Đăng ký ca · ${shiftName(payload.shiftId) ?? ''}`;
  if (type === 'shift_pass') {
    const role = payload.positionName ? ` (${String(payload.positionName)})` : '';
    return `Pass ${shiftName(payload.shiftId) ?? 'ca'}${role} cho ${String(payload.toName ?? '')}`;
  }
  return `Làm thêm ${String(payload.from)}–${String(payload.to)}`;
}
