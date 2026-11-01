import type { DayStatus } from '@/lib/engine/types';

/** Ký hiệu ô Bảng công theo đặc tả; thứ tự mảng là ưu tiên khi một ngày có nhiều ca. */
const SYMBOLS = [
  { key: 'vang', label: 'V', title: 'Vắng' },
  { key: 'thieu', label: '!', title: 'Thiếu giờ vào/ra' },
  { key: 'vung', label: 'G', title: 'Ngoài vùng' },
  { key: 'ca', label: 'C', title: 'Sai ca hoặc ngoài lịch' },
  { key: 'ot_cho', label: '+', title: 'OT chờ duyệt' },
  { key: 'muon', label: 'M', title: 'Muộn hoặc về sớm' },
  { key: 'nua', label: '½', title: 'Thiếu công' },
  { key: 'ot_duyet', label: '+', title: 'OT đã duyệt' },
  { key: 'du', label: '', title: 'Đủ công' },
  { key: 'phep', label: 'P', title: 'Nghỉ phép' },
  { key: 'le', label: 'L', title: 'Nghỉ lễ' },
  { key: 'trong', label: '', title: 'Không có công' },
] as const;

export type DaySymbolKey = (typeof SYMBOLS)[number]['key'];
export type DaySymbol = (typeof SYMBOLS)[number];

const BY_STATUS: Record<DayStatus, DaySymbolKey> = {
  vang: 'vang',
  thieu_gio: 'thieu',
  ngoai_vung: 'vung',
  sai_ca: 'ca',
  ngoai_lich: 'ca',
  ot_cho: 'ot_cho',
  muon: 'muon',
  nua_cong: 'nua',
  du: 'du',
  nghi_phep: 'phep',
  le: 'le',
  chua_toi: 'trong',
  dang_lam: 'trong',
  nghi: 'trong',
};

type SymbolInput = { status: DayStatus; otApproved: number };

function keyOf({ status, otApproved }: SymbolInput): DaySymbolKey {
  return status === 'du' && otApproved > 0 ? 'ot_duyet' : BY_STATUS[status];
}

/** Ký hiệu của một ô: lấy ca cần xử lý nhất trong ngày, không có ca nào là ô trống. */
export function daySymbol(records: readonly SymbolInput[]): DaySymbol {
  const keys = records.map(keyOf);
  return SYMBOLS.find(({ key }) => keys.includes(key)) ?? SYMBOLS[SYMBOLS.length - 1]!;
}

export const SYMBOL_LEGEND = SYMBOLS.filter(({ key }) => key !== 'trong');
