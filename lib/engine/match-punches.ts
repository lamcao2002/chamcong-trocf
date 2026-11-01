import { offsetFrom, shiftSpanMinutes, toMinutes } from '@/lib/domain/shift';
import type { EnginePunch, EngineShift } from './types';

/** Cửa sổ ghép đã chốt ở quyết định A1, B1 của đặc tả. */
const EARLY_IN_MINUTES = 120;
const LATE_OUT_MINUTES = 6 * 60;
const HANDOVER_OUT_MINUTES = 15;
const DAY_MINUTES = 24 * 60;

export type TimedPunch = EnginePunch & { minute: number };

export type ShiftWindow = {
  shift: EngineShift;
  start: number;
  /** Ca qua đêm có `end` lớn hơn 1440. */
  end: number;
  break: { start: number; end: number } | null;
};

export type ShiftPunches = {
  window: ShiftWindow;
  punches: TimedPunch[];
  /** Mốc hiệu lực sau khi tách ca liền nhau; NULL là thiếu lần chấm. */
  inMinute: number | null;
  outMinute: number | null;
};

export function shiftWindow(shift: EngineShift): ShiftWindow {
  const start = toMinutes(shift.startTime);
  const hasBreak = shift.breakStart !== null && shift.breakEnd !== null;
  return {
    shift,
    start,
    end: start + shiftSpanMinutes(shift),
    break: hasBreak
      ? {
          start: start + offsetFrom(shift.startTime, shift.breakStart!),
          end: start + offsetFrom(shift.startTime, shift.breakEnd!),
        }
      : null,
  };
}

const inWindow = ({ start, end }: ShiftWindow, minute: number) =>
  minute >= start - EARLY_IN_MINUTES && minute <= end;

const outWindow = ({ start, end }: ShiftWindow, minute: number) =>
  minute >= start && minute <= end + LATE_OUT_MINUTES;

/** Lần chấm thuộc ca hôm trước: ca đêm, hoặc ở lại muộn qua nửa đêm. */
function belongsToPreviousDay(
  { type, minute }: TimedPunch,
  previous: readonly ShiftWindow[],
  firstStart: number,
) {
  if (minute >= firstStart) return false;
  const shifted = minute + DAY_MINUTES;
  return previous.some((window) => (type === 'in' ? inWindow : outWindow)(window, shifted));
}

function pickIn(slots: ShiftPunches[], punch: TimedPunch): ShiftPunches | undefined {
  const fits = slots.filter(({ window }) => inWindow(window, punch.minute));
  const open = fits.filter(({ punches }) => !punches.some(({ type }) => type === 'out'));
  const candidates = open.length > 0 ? open : fits;
  return (
    candidates.find(({ window }) => window.shift.id === punch.chosenShiftId) ??
    candidates.find(({ window }) => punch.minute >= window.start && punch.minute < window.end) ??
    [...candidates].sort(
      (a, b) => Math.abs(a.window.start - punch.minute) - Math.abs(b.window.start - punch.minute),
    )[0]
  );
}

function pickOut(slots: ShiftPunches[], { minute }: TimedPunch): ShiftPunches | undefined {
  return slots.find((slot, index) => {
    if (!outWindow(slot.window, minute)) return false;
    const next = slots[index + 1]?.window;
    if (!next || minute < next.start) return true;
    const handover =
      next.start === slot.window.end &&
      minute <= next.start + HANDOVER_OUT_MINUTES &&
      !slot.punches.some(({ type }) => type === 'out');
    return handover;
  });
}

/** Một cặp vào/ra phủ các ca liền nhau được tách tại mốc giao ca (Bước B mục 3, T29). */
function splitAdjacent(slots: ShiftPunches[]) {
  slots.forEach((first, index) => {
    if (first.inMinute === null || first.outMinute !== null) return;
    for (let last = index + 1; last < slots.length; last += 1) {
      const slot = slots[last]!;
      if (slot.window.start !== slots[last - 1]!.window.end || slot.inMinute !== null) return;
      if (slot.outMinute === null) continue;
      for (let at = index; at < last; at += 1) {
        slots[at]!.outMinute = slots[at]!.window.end;
        slots[at + 1]!.inMinute = slots[at + 1]!.window.start;
      }
      return;
    }
  });
}

/** Bước B: gán mỗi lần chấm vào một ca; lần không gán được là làm ngoài lịch. `windows` xếp theo giờ vào. */
export function matchPunches(
  windows: readonly ShiftWindow[],
  punches: readonly TimedPunch[],
  previous: readonly ShiftWindow[],
): { slots: ShiftPunches[]; unmatched: TimedPunch[] } {
  const slots: ShiftPunches[] = windows.map((window) => ({
    window,
    punches: [],
    inMinute: null,
    outMinute: null,
  }));
  const unmatched: TimedPunch[] = [];
  const firstStart = windows[0]?.start ?? DAY_MINUTES;

  for (const punch of [...punches].sort((a, b) => a.minute - b.minute)) {
    if (belongsToPreviousDay(punch, previous, firstStart)) continue;
    const slot = punch.type === 'in' ? pickIn(slots, punch) : pickOut(slots, punch);
    if (slot) slot.punches.push(punch);
    else if (punch.minute >= 0 && punch.minute < DAY_MINUTES) unmatched.push(punch);
  }

  // Chấm trùng: lấy lần vào sớm nhất và lần ra muộn nhất (Bước B mục 2)
  for (const slot of slots) {
    const minutes = (type: EnginePunch['type']) =>
      slot.punches.filter((punch) => punch.type === type).map(({ minute }) => minute);
    const ins = minutes('in');
    const outs = minutes('out');
    slot.inMinute = ins.length > 0 ? Math.min(...ins) : null;
    slot.outMinute = outs.length > 0 ? Math.max(...outs) : null;
  }
  splitAdjacent(slots);

  return { slots, unmatched };
}
