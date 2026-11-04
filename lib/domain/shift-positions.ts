import type { ShiftPositions } from '@/lib/db/schema';

/** Vị trí của một ca trong ô; ca chưa ghi vị trí là vị trí chính. */
export function positionOfShift(
  positions: ShiftPositions | null | undefined,
  shiftId: string,
  primaryId: string | null,
): string | null {
  return positions?.[shiftId] ?? primaryId;
}

/**
 * Ghi rõ vị trí cho mọi ca trong ô, bỏ ca không còn trong ô. Ghi cả vị trí chính để đổi vị trí chính
 * về sau không làm đổi vị trí của ca đã làm.
 */
export function normalizePositions(
  shiftIds: readonly string[],
  positions: ShiftPositions | null | undefined,
  primaryId: string | null,
): ShiftPositions {
  return Object.fromEntries(
    shiftIds.flatMap((shiftId) => {
      const positionId = positionOfShift(positions, shiftId, primaryId);
      return positionId ? [[shiftId, positionId]] : [];
    }),
  );
}

type Cell = { shiftIds: readonly string[]; isOff: boolean; positions?: ShiftPositions | null };

/** Hai ô giống nhau khi cùng ca, cùng Cho nghỉ và cùng vị trí của từng ca. */
export function sameScheduleCell(a: Cell, b: Cell, primaryId: string | null) {
  const key = (cell: Cell) =>
    [...cell.shiftIds]
      .sort()
      .map((shiftId) => `${shiftId}:${positionOfShift(cell.positions, shiftId, primaryId) ?? ''}`)
      .join();
  return a.isOff === b.isOff && key(a) === key(b);
}

/** Chữ viết tắt cho ô lịch hẹp: "Phục vụ" → "PV". */
export function positionShort(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}
