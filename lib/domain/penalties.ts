import { formatClock, formatMoney } from '@/lib/format';

/** Ghi chú bằng chứng tối thiểu, để không phạt chỉ bằng một chữ "trễ". */
export const MIN_PENALTY_NOTE = 10;
export const MAX_SCARS = 99;
export const MAX_PENALTY_AMOUNT = 100_000_000;
/** Phạt được ngày vi phạm trong khoảng này trở lại; xa hơn thì khó còn bằng chứng. */
export const PENALTY_BACK_DAYS = 60;
/** Nhãn của mục "Khác" khi phạt ngoài danh sách quy định. */
export const OTHER_RULE = 'Khác';

type Counted = { scars: number; amount: number; cancelledAt: Date | string | null };

/** Tổng sẹo và tiền, bỏ phiếu đã huỷ. */
export function activeTotals(rows: readonly Counted[]) {
  return rows.reduce(
    (total, row) =>
      row.cancelledAt
        ? total
        : { scars: total.scars + row.scars, amount: total.amount + row.amount, count: total.count + 1 },
    { scars: 0, amount: 0, count: 0 },
  );
}

/** Lần phạt này đưa số sẹo từ dưới ngưỡng lên đủ ngưỡng; ngưỡng tắt thì không bao giờ. */
export function crossedThreshold(before: number, after: number, threshold: number | null) {
  return threshold !== null && before < threshold && after >= threshold;
}

export const overThreshold = (scars: number, threshold: number | null) =>
  threshold !== null && scars >= threshold;

/** "2 sẹo · 50.000đ", "1 sẹo", "30.000đ". */
export function penaltyValueLabel({ scars, amount }: { scars: number; amount: number }) {
  return [scars > 0 ? `${scars} sẹo` : '', amount > 0 ? formatMoney(amount) : ''].filter(Boolean).join(' · ');
}

// ——— Lỗi chấm công ———

/** Lỗi chấm công phạt được; phiếu phạt gắn với một lỗi của một ca. */
export const PENALTY_ISSUES = ['muon', 've_som', 'quen_vao', 'quen_ra'] as const;
export type PenaltyIssue = (typeof PENALTY_ISSUES)[number];

type IssueDay = {
  shiftId: string | null;
  inAt: Date | string | null;
  outAt: Date | string | null;
  lateMin: number;
  earlyMin: number;
  waivedLate: boolean;
  waivedEarly: boolean;
  missing: number;
};

/**
 * Lỗi còn phạt được của một ca. Muộn, sớm đã miễn (đơn Muộn/sớm, quản lý tha) thì không còn lỗi.
 * Quên chấm đọc từ `missing`, engine đếm trước bước duyệt nên duyệt công vẫn giữ lỗi. Ca đang làm và
 * ca vắng hẳn có `missing = 0`.
 */
export function attendanceIssues(day: IssueDay): PenaltyIssue[] {
  if (!day.shiftId) return [];
  return [
    ...(day.lateMin > 0 && !day.waivedLate ? (['muon'] as const) : []),
    ...(day.earlyMin > 0 && !day.waivedEarly ? (['ve_som'] as const) : []),
    ...(day.missing > 0 && day.inAt === null && day.outAt !== null ? (['quen_vao'] as const) : []),
    ...(day.missing > 0 && day.outAt === null && day.inAt !== null ? (['quen_ra'] as const) : []),
  ];
}

/** "Muộn 14 phút", "Về sớm 10 phút", "Quên chấm vào", "Quên chấm ra". */
export function issueLabel(
  issue: PenaltyIssue,
  { lateMin, earlyMin }: { lateMin: number; earlyMin: number },
) {
  if (issue === 'muon') return `Muộn ${lateMin} phút`;
  if (issue === 've_som') return `Về sớm ${earlyMin} phút`;
  return issue === 'quen_vao' ? 'Quên chấm vào' : 'Quên chấm ra';
}

/** Bản chụp chấm công lưu vào phiếu lúc phạt; sửa công sau đó không đổi bằng chứng. */
export type PenaltyEvidence = {
  shiftCode: string;
  shiftHours: string;
  inAt: string | null;
  outAt: string | null;
  issueLabel: string;
};

/** "Ca S1 (07:00–15:00): Vào 07:14, Ra 15:00 · Muộn 14 phút". */
export function evidenceLine({ shiftCode, shiftHours, inAt, outAt, issueLabel }: PenaltyEvidence) {
  const punches = `Vào ${inAt ? formatClock(inAt) : '—'}, Ra ${outAt ? formatClock(outAt) : '—'}`;
  return `Ca ${shiftCode} (${shiftHours}): ${punches} · ${issueLabel}`;
}

/** Ghi chú cần hiện thêm; trùng dòng chấm công điền sẵn thì không hiện lại lần nữa. */
export const extraNote = ({ note, evidence }: { note: string; evidence: PenaltyEvidence | null }) =>
  evidence && note === evidenceLine(evidence) ? null : note;
