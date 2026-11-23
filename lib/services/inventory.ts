import 'server-only';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ApiError, notFound } from '@/lib/api/errors';
import { writeAudit, type Tx } from '@/lib/audit';
import { scopeToCompany, scopeToStaff, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import {
  attendanceLogs,
  employees,
  inventoryItems,
  inventoryReportLines,
  inventoryReports,
  inventorySheetItems,
  inventorySheetPositions,
  inventorySheets,
  positions,
  scheduleCells,
  shifts,
} from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { isMismatch } from '@/lib/domain/inventory';
import { editableUntil, REQUEST_EDIT_MINUTES } from '@/lib/domain/request-window';
import { positionOfShift } from '@/lib/domain/shift-positions';
import { expectedShifts } from '@/lib/engine/expected-shifts';
import type { EngineShift } from '@/lib/engine/types';
import { formatDate } from '@/lib/format';
import {
  missingReasons,
  type InventoryItemInput,
  type InventoryReportEditInput,
  type InventoryReportInput,
  type InventorySheetInput,
} from '@/lib/validation/inventory';
import type { DecisionInput } from '@/lib/validation/request';
import { actorOf } from './actor';
import { assertCanDecide } from './approvals';
import { OPEN_PUNCH_MS } from './attendance';
import { notify } from './notifications';
import { loadEmployeeRules, lockEmployees } from './recompute';
import { assertOwned } from './references';

type Reader = Pick<Tx, 'select'>;

const ITEM_COLUMNS = {
  id: inventoryItems.id,
  kind: inventoryItems.kind,
  name: inventoryItems.name,
  unit: inventoryItems.unit,
  quantity: inventoryItems.quantity,
  note: inventoryItems.note,
};

const catalogOf = (db: Reader, companyId: string) =>
  db
    .select(ITEM_COLUMNS)
    .from(inventoryItems)
    .where(eq(inventoryItems.companyId, companyId))
    .orderBy(asc(inventoryItems.name));

export type InventoryItemView = Awaited<ReturnType<typeof catalogOf>>[number];

/** Phiếu kèm vị trí và món theo thứ tự đếm; `sheetIds` bỏ trống là mọi phiếu của công ty. */
async function sheetsOf(db: Reader, companyId: string, sheetIds?: readonly string[]) {
  if (sheetIds?.length === 0) return [];
  const rows = await db
    .select({ id: inventorySheets.id, name: inventorySheets.name })
    .from(inventorySheets)
    .where(
      and(
        eq(inventorySheets.companyId, companyId),
        sheetIds ? inArray(inventorySheets.id, sheetIds) : undefined,
      ),
    )
    .orderBy(asc(inventorySheets.createdAt));
  const ids = rows.map(({ id }) => id);
  if (ids.length === 0) return [];
  const [links, items] = await Promise.all([
    db.select().from(inventorySheetPositions).where(inArray(inventorySheetPositions.sheetId, ids)),
    db
      .select({ sheetId: inventorySheetItems.sheetId, ...ITEM_COLUMNS })
      .from(inventorySheetItems)
      .innerJoin(inventoryItems, eq(inventoryItems.id, inventorySheetItems.itemId))
      .where(inArray(inventorySheetItems.sheetId, ids))
      .orderBy(asc(inventorySheetItems.sortOrder)),
  ]);
  return rows.map((sheet) => ({
    ...sheet,
    positionIds: links.filter((link) => link.sheetId === sheet.id).map((link) => link.positionId),
    items: items.filter((item) => item.sheetId === sheet.id).map(({ sheetId: _sheet, ...item }) => item),
  }));
}

export type InventorySheetView = Awaited<ReturnType<typeof sheetsOf>>[number];

// ——— Danh mục và phiếu của quản lý ———

/** Danh mục món, các phiếu và vị trí để chọn. */
export async function listInventory(ctx: AuthContext) {
  const db = getDb();
  const [positionRows, items, sheets] = await Promise.all([
    db
      .select({ id: positions.id, name: positions.name })
      .from(positions)
      .where(scopeToCompany(ctx, positions.companyId))
      .orderBy(asc(positions.createdAt)),
    catalogOf(db, ctx.company.id),
    sheetsOf(db, ctx.company.id),
  ]);
  return { positions: positionRows, items, sheets };
}

export type InventoryListView = Awaited<ReturnType<typeof listInventory>>;

export async function createInventoryItem(ctx: AuthContext, input: InventoryItemInput) {
  return getDb().transaction(async (tx) => {
    const [item] = await tx
      .insert(inventoryItems)
      .values({ ...input, companyId: ctx.company.id })
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'inventory_item.create',
      entity: 'inventory_item',
      entityId: item!.id,
      after: item,
    });
    return item!;
  });
}

const findItem = (ctx: AuthContext, id: string) =>
  and(eq(inventoryItems.id, id), scopeToCompany(ctx, inventoryItems.companyId));

/** Sửa số hiện có ở đây không đổi báo cáo đã gửi: báo cáo giữ số chụp lúc gửi. */
export async function updateInventoryItem(ctx: AuthContext, id: string, input: InventoryItemInput) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(inventoryItems).where(findItem(ctx, id)).for('update');
    if (!before) throw notFound('món kiểm kê');
    const [item] = await tx.update(inventoryItems).set(input).where(findItem(ctx, id)).returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'inventory_item.update',
      entity: 'inventory_item',
      entityId: id,
      before,
      after: item,
    });
    return item!;
  });
}

/** Xoá khỏi danh mục thì món tự rời mọi phiếu; báo cáo cũ giữ tên món. */
export async function deleteInventoryItem(ctx: AuthContext, id: string) {
  await getDb().transaction(async (tx) => {
    const [before] = await tx.delete(inventoryItems).where(findItem(ctx, id)).returning();
    if (!before) throw notFound('món kiểm kê');
    await writeAudit(tx, actorOf(ctx), {
      action: 'inventory_item.delete',
      entity: 'inventory_item',
      entityId: id,
      before,
    });
  });
}

/** Ghi lại vị trí và món của phiếu: thay toàn bộ, thứ tự món theo `itemIds`. */
async function writeSheetLinks(tx: Tx, ctx: AuthContext, sheetId: string, input: InventorySheetInput) {
  await assertOwned(tx, ctx, positions, input.positionIds, 'positionIds');
  await assertOwned(tx, ctx, inventoryItems, input.itemIds, 'itemIds');
  await tx.delete(inventorySheetPositions).where(eq(inventorySheetPositions.sheetId, sheetId));
  await tx.delete(inventorySheetItems).where(eq(inventorySheetItems.sheetId, sheetId));
  await tx
    .insert(inventorySheetPositions)
    .values(input.positionIds.map((positionId) => ({ sheetId, positionId })));
  await tx
    .insert(inventorySheetItems)
    .values(input.itemIds.map((itemId, sortOrder) => ({ sheetId, itemId, sortOrder })));
}

export async function createInventorySheet(ctx: AuthContext, input: InventorySheetInput) {
  return getDb().transaction(async (tx) => {
    const [sheet] = await tx
      .insert(inventorySheets)
      .values({ companyId: ctx.company.id, name: input.name })
      .returning();
    await writeSheetLinks(tx, ctx, sheet!.id, input);
    await writeAudit(tx, actorOf(ctx), {
      action: 'inventory_sheet.create',
      entity: 'inventory_sheet',
      entityId: sheet!.id,
      after: { ...sheet, positionIds: input.positionIds, itemIds: input.itemIds },
    });
    return sheet!;
  });
}

const findSheet = (ctx: AuthContext, id: string) =>
  and(eq(inventorySheets.id, id), scopeToCompany(ctx, inventorySheets.companyId));

/** Sửa phiếu không đổi báo cáo đã gửi; nhân viên đang đếm dở thì lúc gửi được báo mở lại. */
export async function updateInventorySheet(ctx: AuthContext, id: string, input: InventorySheetInput) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(inventorySheets).where(findSheet(ctx, id)).for('update');
    if (!before) throw notFound('phiếu kiểm kê');
    const [old] = await sheetsOf(tx, ctx.company.id, [id]);
    const [sheet] = await tx
      .update(inventorySheets)
      .set({ name: input.name })
      .where(findSheet(ctx, id))
      .returning();
    await writeSheetLinks(tx, ctx, id, input);
    await writeAudit(tx, actorOf(ctx), {
      action: 'inventory_sheet.update',
      entity: 'inventory_sheet',
      entityId: id,
      before: { ...before, positionIds: old?.positionIds, itemIds: old?.items.map((item) => item.id) },
      after: { ...sheet, positionIds: input.positionIds, itemIds: input.itemIds },
    });
    return sheet!;
  });
}

/** Báo cáo của phiếu giữ tên phiếu đã chụp. */
export async function deleteInventorySheet(ctx: AuthContext, id: string) {
  await getDb().transaction(async (tx) => {
    const [before] = await tx.delete(inventorySheets).where(findSheet(ctx, id)).returning();
    if (!before) throw notFound('phiếu kiểm kê');
    await writeAudit(tx, actorOf(ctx), {
      action: 'inventory_sheet.delete',
      entity: 'inventory_sheet',
      entityId: id,
      before,
    });
  });
}

// ——— Đọc báo cáo, dùng chung cho quản lý và nhân viên ———

const decider = alias(employees, 'decider');
const mismatchCount = sql<number>`(select count(*)::int from ${inventoryReportLines}
  where ${inventoryReportLines.reportId} = ${inventoryReports.id}
  and ${inventoryReportLines.expected} <> ${inventoryReportLines.counted})`;
const lineCount = sql<number>`(select count(*)::int from ${inventoryReportLines}
  where ${inventoryReportLines.reportId} = ${inventoryReports.id})`;

function reportQuery(db: Reader) {
  return db
    .select({
      id: inventoryReports.id,
      employeeId: inventoryReports.employeeId,
      employeeName: employees.name,
      sheetId: inventoryReports.sheetId,
      sheetName: inventoryReports.sheetName,
      positionName: inventoryReports.positionName,
      date: inventoryReports.date,
      shiftName: shifts.name,
      status: inventoryReports.status,
      createdAt: inventoryReports.createdAt,
      updatedAt: inventoryReports.updatedAt,
      decidedAt: inventoryReports.decidedAt,
      deciderName: decider.name,
      decisionNote: inventoryReports.decisionNote,
      mismatchCount,
      lineCount,
    })
    .from(inventoryReports)
    .innerJoin(employees, eq(employees.id, inventoryReports.employeeId))
    .leftJoin(shifts, eq(shifts.id, inventoryReports.shiftId))
    .leftJoin(decider, eq(decider.id, inventoryReports.decidedBy));
}

type ReportRow = Awaited<ReturnType<ReturnType<typeof reportQuery>['execute']>>[number];

const isoOf = (value: Date | null) => (value ? value.toISOString() : null);

function reportView(row: ReportRow, now: Date) {
  const until = editableUntil(
    { type: 'inventory', status: row.status, fromDate: row.date, createdAt: row.createdAt },
    now,
  );
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: isoOf(row.updatedAt),
    decidedAt: isoOf(row.decidedAt),
    editableUntil: isoOf(until),
  };
}

export type InventoryReportRow = ReturnType<typeof reportView>;

async function linesOf(db: Reader, reportId: string) {
  return db
    .select({
      id: inventoryReportLines.id,
      itemId: inventoryReportLines.itemId,
      kind: inventoryReportLines.kind,
      name: inventoryReportLines.name,
      unit: inventoryReportLines.unit,
      expected: inventoryReportLines.expected,
      counted: inventoryReportLines.counted,
      note: inventoryReportLines.note,
      /** Số hiện có lúc này; khác `expected` là đã có người sửa sau lúc gửi. NULL = món đã bị xoá. */
      current: inventoryItems.quantity,
    })
    .from(inventoryReportLines)
    .leftJoin(inventoryItems, eq(inventoryItems.id, inventoryReportLines.itemId))
    .where(eq(inventoryReportLines.reportId, reportId))
    .orderBy(asc(inventoryReportLines.sortOrder));
}

export type InventoryReportDetail = InventoryReportRow & { lines: Awaited<ReturnType<typeof linesOf>> };

/** [Đề xuất] Màn quản lý hiện mọi báo cáo chờ và chừng này báo cáo đã xử lý gần nhất. */
const DECIDED_LIMIT = 100;

export async function listInventoryReports(ctx: AuthContext, now: Date = new Date()) {
  const db = getDb();
  const scope = scopeToStaff(ctx, {
    companyId: inventoryReports.companyId,
    employeeId: inventoryReports.employeeId,
  });
  const order = [desc(inventoryReports.date), desc(inventoryReports.createdAt)];
  const [pending, decided] = await Promise.all([
    reportQuery(db)
      .where(and(scope, eq(inventoryReports.status, 'pending')))
      .orderBy(...order),
    reportQuery(db)
      .where(and(scope, sql`${inventoryReports.status} <> 'pending'`))
      .orderBy(...order)
      .limit(DECIDED_LIMIT),
  ]);
  return [...pending, ...decided].map((row) => reportView(row, now));
}

export async function getInventoryReport(
  ctx: AuthContext,
  id: string,
  now: Date = new Date(),
): Promise<InventoryReportDetail> {
  const db = getDb();
  const [row] = await reportQuery(db).where(
    and(
      eq(inventoryReports.id, id),
      scopeToStaff(ctx, { companyId: inventoryReports.companyId, employeeId: inventoryReports.employeeId }),
    ),
  );
  if (!row) throw notFound('báo cáo kiểm kê');
  return { ...reportView(row, now), lines: await linesOf(db, id) };
}

/** Duyệt thì số đếm thành số hiện có mới của từng món; từ chối thì giữ số cũ. */
export async function decideInventoryReport(ctx: AuthContext, id: string, { decision, note }: DecisionInput) {
  await getDb().transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(inventoryReports)
      .where(
        and(
          eq(inventoryReports.id, id),
          scopeToStaff(ctx, {
            companyId: inventoryReports.companyId,
            employeeId: inventoryReports.employeeId,
          }),
        ),
      )
      .for('update');
    if (!report) throw notFound('báo cáo kiểm kê');
    if (report.status !== 'pending') throw new ApiError(409, 'Báo cáo này đã được xử lý');
    await assertCanDecide(tx, ctx, report.employeeId);

    const lines = await tx.select().from(inventoryReportLines).where(eq(inventoryReportLines.reportId, id));
    if (decision === 'approve') {
      for (const { itemId, counted } of lines) {
        if (!itemId) continue;
        await tx
          .update(inventoryItems)
          .set({ quantity: counted })
          .where(and(eq(inventoryItems.id, itemId), scopeToCompany(ctx, inventoryItems.companyId)));
      }
    }
    const status = decision === 'approve' ? 'approved' : 'rejected';
    const [after] = await tx
      .update(inventoryReports)
      .set({ status, decidedBy: ctx.employee.id, decidedAt: new Date(), decisionNote: note || null })
      .where(eq(inventoryReports.id, id))
      .returning();

    await notify(tx, [
      {
        companyId: ctx.company.id,
        employeeId: report.employeeId,
        kind: 'inventory',
        title: `${report.sheetName} ${decision === 'approve' ? 'đã được duyệt' : 'bị từ chối'}`,
        body: [formatDate(report.date).slice(0, 5), ...(note ? [note] : [])].join(' · '),
        href: '#/toi',
      },
    ]);
    await writeAudit(tx, actorOf(ctx), {
      action: `inventory_report.${decision}`,
      entity: 'inventory_report',
      entityId: id,
      before: report,
      after: {
        ...after,
        updatedItems: decision === 'approve' ? lines.filter((line) => line.itemId).length : 0,
      },
    });
  });
}

// ——— App nhân viên ———

/**
 * Ca đang làm: lần chấm cuối trong 18 giờ là VÀO CA. Ca lấy theo ca đã chọn lúc vào, không chọn thì
 * theo ca phải làm trong ngày; vị trí theo vị trí của ca đó trên lịch, không có thì vị trí chính.
 */
async function currentShift(db: Reader, ctx: AuthContext, now: Date) {
  const employeeId = ctx.employee.id;
  const [last] = await db
    .select({
      id: attendanceLogs.id,
      type: attendanceLogs.type,
      at: attendanceLogs.at,
      chosen: attendanceLogs.chosenShiftId,
    })
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.employeeId, employeeId),
        gte(attendanceLogs.at, new Date(now.getTime() - OPEN_PUNCH_MS)),
      ),
    )
    .orderBy(desc(attendanceLogs.at))
    .limit(1);
  if (!last || last.type !== 'in') return null;

  const date = vietnamToday(last.at);
  const [[employee], [cell], library, rules] = await Promise.all([
    db.select({ positionId: employees.positionId }).from(employees).where(eq(employees.id, employeeId)),
    db
      .select({
        shiftIds: scheduleCells.shiftIds,
        isOff: scheduleCells.isOff,
        positions: scheduleCells.positions,
      })
      .from(scheduleCells)
      .where(and(eq(scheduleCells.employeeId, employeeId), eq(scheduleCells.date, date))),
    db.select().from(shifts).where(eq(shifts.companyId, ctx.company.id)) as Promise<EngineShift[]>,
    loadEmployeeRules(db, [employeeId]),
  ]);
  const primary = employee?.positionId ?? null;
  const rule = rules.get(employeeId);
  const shiftId =
    last.chosen ??
    (rule
      ? expectedShifts({ date, employee: rule, schedule: cell ?? null, shifts: library }).shifts[0]?.id
      : null) ??
    null;
  const positionId = shiftId ? positionOfShift(cell?.positions, shiftId, primary) : primary;
  const [position] = positionId
    ? await db
        .select({ id: positions.id, name: positions.name })
        .from(positions)
        .where(eq(positions.id, positionId))
    : [];
  return {
    punchInId: last.id,
    date,
    shiftId,
    shiftName: library.find(({ id }) => id === shiftId)?.name ?? null,
    position: position ?? null,
  };
}

/** Phiếu của vị trí ca đang làm, mỗi phiếu kèm báo cáo đã gửi trong ca này (nếu có). */
async function sheetsForShift(db: Reader, ctx: AuthContext, positionId: string) {
  const ids = await db
    .select({ id: inventorySheetPositions.sheetId })
    .from(inventorySheetPositions)
    .where(eq(inventorySheetPositions.positionId, positionId));
  const sheets = await sheetsOf(
    db,
    ctx.company.id,
    ids.map(({ id }) => id),
  );
  // Phiếu chưa có món (món bị xoá hết khỏi danh mục) thì không có gì để đếm
  return sheets.filter((sheet) => sheet.items.length > 0);
}

/** Màn kiểm kê trong ca; `shift` null là chưa VÀO CA, `shift.position` null là ca chưa có vị trí. */
export async function getMyInventory(ctx: AuthContext, now: Date = new Date()) {
  const db = getDb();
  const shift = await currentShift(db, ctx, now);
  if (!shift) return { shift: null, sheets: [] };
  const { punchInId, ...shiftView } = shift;
  if (!shift.position) return { shift: shiftView, sheets: [] };

  const [sheets, sent] = await Promise.all([
    sheetsForShift(db, ctx, shift.position.id),
    db
      .select({ id: inventoryReports.id, sheetId: inventoryReports.sheetId })
      .from(inventoryReports)
      .where(eq(inventoryReports.punchInId, punchInId)),
  ]);
  const reports = await Promise.all(sent.map(({ id }) => getMyInventoryReport(ctx, id, now)));
  return {
    shift: shiftView,
    sheets: sheets.map((sheet) => ({
      ...sheet,
      report: reports.find((report) => report.sheetId === sheet.id) ?? null,
    })),
  };
}

export type MyInventoryView = Awaited<ReturnType<typeof getMyInventory>>;

/** [Đề xuất] Số lần kiểm kê gần nhất hiện ở tab Tôi. */
const MY_LIMIT = 20;

export async function listMyInventoryReports(ctx: AuthContext, now: Date = new Date()) {
  const rows = await reportQuery(getDb())
    .where(eq(inventoryReports.employeeId, ctx.employee.id))
    .orderBy(desc(inventoryReports.createdAt))
    .limit(MY_LIMIT);
  return rows.map((row) => reportView(row, now));
}

export async function getMyInventoryReport(ctx: AuthContext, id: string, now: Date = new Date()) {
  const db = getDb();
  const [row] = await reportQuery(db).where(
    and(eq(inventoryReports.id, id), eq(inventoryReports.employeeId, ctx.employee.id)),
  );
  if (!row) throw notFound('báo cáo kiểm kê');
  return { ...reportView(row, now), lines: await linesOf(db, id) };
}

function throwMissingReasons(fields: Record<string, string>) {
  if (Object.keys(fields).length > 0) throw new ApiError(400, 'Ghi lý do cho các món bị lệch', fields);
}

export async function submitInventoryReport(
  ctx: AuthContext,
  input: InventoryReportInput,
  now: Date = new Date(),
) {
  return getDb().transaction(async (tx) => {
    await lockEmployees(tx, [ctx.employee.id]);
    const shift = await currentShift(tx, ctx, now);
    if (!shift) throw new ApiError(409, 'Bạn cần VÀO CA trước khi kiểm kê');
    if (!shift.position) throw new ApiError(409, 'Ca này chưa có vị trí nên không có phiếu kiểm kê');
    const sheet = (await sheetsForShift(tx, ctx, shift.position.id)).find(({ id }) => id === input.sheetId);
    if (!sheet) throw new ApiError(404, 'Phiếu này không dành cho vị trí ca bạn đang làm');
    const [sent] = await tx
      .select({ id: inventoryReports.id })
      .from(inventoryReports)
      .where(and(eq(inventoryReports.punchInId, shift.punchInId), eq(inventoryReports.sheetId, sheet.id)));
    if (sent) throw new ApiError(409, 'Ca này bạn đã gửi phiếu này rồi');

    const { items } = sheet;
    const sentIds = input.lines.map(({ itemId }) => itemId);
    const sameList =
      new Set(sentIds).size === sentIds.length &&
      sentIds.length === items.length &&
      items.every(({ id }) => sentIds.includes(id));
    if (!sameList) {
      throw new ApiError(409, 'Phiếu vừa được quản lý sửa, hãy mở lại để đếm theo phiếu mới');
    }

    const byId = new Map(items.map((item) => [item.id, item]));
    throwMissingReasons(
      missingReasons(input.lines.map((line) => ({ ...line, expected: byId.get(line.itemId)!.quantity }))),
    );

    const [report] = await tx
      .insert(inventoryReports)
      .values({
        companyId: ctx.company.id,
        employeeId: ctx.employee.id,
        punchInId: shift.punchInId,
        sheetId: sheet.id,
        sheetName: sheet.name,
        positionId: shift.position.id,
        positionName: shift.position.name,
        date: shift.date,
        shiftId: shift.shiftId,
        createdAt: now,
      })
      .returning();
    const lines = await tx
      .insert(inventoryReportLines)
      .values(
        items.map((item, index) => {
          const line = input.lines.find(({ itemId }) => itemId === item.id)!;
          return {
            reportId: report!.id,
            itemId: item.id,
            kind: item.kind,
            name: item.name,
            unit: item.unit,
            expected: item.quantity,
            counted: line.counted,
            // Số khớp thì không giữ lý do: dòng không lệch không cần giải thích
            note: isMismatch(item.quantity, line.counted) ? line.note : null,
            sortOrder: index,
          };
        }),
      )
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'inventory_report.create',
      entity: 'inventory_report',
      entityId: report!.id,
      after: { ...report, lines },
    });
    return report!;
  });
}

/** Báo cáo của mình còn chờ và còn trong 10 phút từ lúc gửi; khoá dòng để không trùng lúc quản lý duyệt. */
async function lockOwnEditable(tx: Tx, ctx: AuthContext, id: string, now: Date) {
  const [report] = await tx
    .select()
    .from(inventoryReports)
    .where(and(eq(inventoryReports.id, id), eq(inventoryReports.employeeId, ctx.employee.id)))
    .for('update');
  if (!report) throw notFound('báo cáo kiểm kê');
  if (report.status !== 'pending') {
    throw new ApiError(409, 'Báo cáo đã được xử lý, không sửa hay xoá được nữa');
  }
  if (
    !editableUntil(
      { type: 'inventory', status: report.status, fromDate: report.date, createdAt: report.createdAt },
      now,
    )
  ) {
    throw new ApiError(409, `Đã quá ${REQUEST_EDIT_MINUTES} phút từ lúc gửi, không sửa hay xoá được nữa`);
  }
  return report;
}

export async function updateMyInventoryReport(
  ctx: AuthContext,
  id: string,
  input: InventoryReportEditInput,
  now: Date = new Date(),
) {
  return getDb().transaction(async (tx) => {
    const report = await lockOwnEditable(tx, ctx, id, now);
    const before = await tx
      .select()
      .from(inventoryReportLines)
      .where(eq(inventoryReportLines.reportId, id))
      .orderBy(asc(inventoryReportLines.sortOrder));
    const sentIds = input.lines.map((line) => line.id);
    const sameLines =
      new Set(sentIds).size === sentIds.length &&
      sentIds.length === before.length &&
      before.every((line) => sentIds.includes(line.id));
    if (!sameLines) throw new ApiError(400, 'Dòng kiểm kê không khớp báo cáo đã gửi');

    const byId = new Map(before.map((line) => [line.id, line]));
    throwMissingReasons(
      missingReasons(input.lines.map((line) => ({ ...line, expected: byId.get(line.id)!.expected }))),
    );
    for (const line of input.lines) {
      const { expected } = byId.get(line.id)!;
      await tx
        .update(inventoryReportLines)
        .set({ counted: line.counted, note: isMismatch(expected, line.counted) ? line.note : null })
        .where(and(eq(inventoryReportLines.id, line.id), eq(inventoryReportLines.reportId, id)));
    }
    const [after] = await tx
      .update(inventoryReports)
      .set({ updatedAt: now })
      .where(eq(inventoryReports.id, id))
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'inventory_report.update',
      entity: 'inventory_report',
      entityId: id,
      before: { ...report, lines: before },
      after: { ...after, lines: input.lines },
    });
    return after!;
  });
}

export async function deleteMyInventoryReport(ctx: AuthContext, id: string, now: Date = new Date()) {
  await getDb().transaction(async (tx) => {
    const report = await lockOwnEditable(tx, ctx, id, now);
    const lines = await tx.select().from(inventoryReportLines).where(eq(inventoryReportLines.reportId, id));
    await tx.delete(inventoryReports).where(eq(inventoryReports.id, id));
    await writeAudit(tx, actorOf(ctx), {
      action: 'inventory_report.delete',
      entity: 'inventory_report',
      entityId: id,
      before: { ...report, lines },
    });
  });
}
