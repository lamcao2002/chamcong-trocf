'use client';

import { useCallback, useEffect, useState } from 'react';
import { Tag } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { apiRequest } from '@/lib/api/client';
import { formatClock } from '@/lib/format';
import type { InventoryReportDetail, InventoryReportRow, MyInventoryView } from '@/lib/services/inventory';
import { INVENTORY_STATUS, InventorySheet, MismatchTag, type InventorySource } from './InventorySheet';
import styles from './EmployeeScreen.module.css';

export type SheetChoice = { id: string; name: string; itemCount: number; source: InventorySource };

/** Các phiếu nhân viên mở được trong ca này, hoặc lý do chưa kiểm kê được. */
export function inventoryChoices(view: MyInventoryView): SheetChoice[] | string {
  const { shift, sheets } = view;
  if (!shift) {
    return 'Bạn cần VÀO CA trước. Kiểm kê chỉ gửi được trong ca đang làm, theo phiếu của vị trí ca đó.';
  }
  if (sheets.length === 0) {
    return `${shift.position ? `Vị trí ${shift.position.name}` : 'Ca này'} chưa có phiếu kiểm kê. Hỏi quản lý nếu ca này cần kiểm kê.`;
  }
  return sheets.map(({ id, name, items, report }) => ({
    id,
    name,
    itemCount: items.length,
    source: report
      ? { kind: 'report', report }
      : { kind: 'new', sheetId: id, sheetName: name, shiftName: shift.shiftName, items },
  }));
}

const editableNow = ({ editableUntil }: InventoryReportRow) =>
  editableUntil !== null && Date.parse(editableUntil) > Date.now();

/** Danh sách phiếu của ca: chưa gửi thì ghi số món, đã gửi thì trạng thái và số món lệch. */
export function SheetPicker({
  choices,
  onPick,
}: {
  choices: SheetChoice[];
  onPick: (source: InventorySource) => void;
}) {
  return (
    <ul className={styles.invSheets}>
      {choices.map(({ id, name, itemCount, source }) => {
        const report = source.kind === 'report' ? source.report : null;
        return (
          <li key={id}>
            <button type="button" className={styles.invSheetRow} onClick={() => onPick(source)}>
              <span className={styles.invSheetMain}>
                <strong>{name}</strong>
                <span className={styles.timelineSub}>
                  {report
                    ? `Đã gửi lúc ${formatClock(report.createdAt)}${editableNow(report) ? ', còn sửa được' : ''}`
                    : `${itemCount} món · chưa gửi`}
                </span>
              </span>
              <span className={styles.invTags}>
                {report ? (
                  <>
                    <Tag color={INVENTORY_STATUS[report.status].color}>
                      {INVENTORY_STATUS[report.status].label}
                    </Tag>
                    <MismatchTag count={report.mismatchCount} />
                  </>
                ) : (
                  <Tag color="processing">Cần kiểm</Tag>
                )}
              </span>
              <RightOutlined aria-hidden className={styles.invChevron} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type InventoryCardProps = {
  brandColor: string | null;
  /** Đổi khi vừa gửi, sửa, xoá kiểm kê từ sheet Tạo đơn: tải lại. */
  reloadKey: number;
};

/** Thẻ ở màn Chấm công khi đang trong ca: các phiếu của vị trí ca này, bấm để đếm hoặc xem lần đã gửi. */
export function InventoryCard({ brandColor, reloadKey }: InventoryCardProps) {
  const [view, setView] = useState<MyInventoryView | null>(null);
  const [source, setSource] = useState<InventorySource | null>(null);

  const load = useCallback(async () => {
    const result = await apiRequest<{ inventory: MyInventoryView }>('/api/v1/app/inventory', 'GET');
    if (result.ok) setView(result.inventory);
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const choices = view ? inventoryChoices(view) : null;
  if (!choices || typeof choices === 'string') return null;
  const waiting = choices.filter((choice) => choice.source.kind === 'new').length;

  return (
    <section className={`${styles.card} ${styles.followCard}`} aria-label="Kiểm kê">
      <div className={styles.requestRow}>
        <strong>Kiểm kê trong ca</strong>
        <span className={styles.timelineSub}>
          {waiting > 0 ? `${waiting}/${choices.length} phiếu chưa gửi` : 'Đã gửi đủ'}
        </span>
      </div>
      <SheetPicker choices={choices} onPick={setSource} />
      <InventorySheet
        source={source}
        brandColor={brandColor}
        onClose={() => setSource(null)}
        onChanged={() => void load()}
      />
    </section>
  );
}

/** Tab Tôi: các lần kiểm kê gần đây; bấm để xem, còn 10 phút thì sửa hoặc xoá. */
export function InventoryHistory({ brandColor, reloadKey }: InventoryCardProps) {
  const [rows, setRows] = useState<InventoryReportRow[] | null>(null);
  const [source, setSource] = useState<InventorySource | null>(null);

  const load = useCallback(async () => {
    const result = await apiRequest<{ reports: InventoryReportRow[] }>(
      '/api/v1/app/inventory/reports',
      'GET',
    );
    if (result.ok) setRows(result.reports);
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const openReport = async (id: string) => {
    const result = await apiRequest<{ report: InventoryReportDetail }>(
      `/api/v1/app/inventory/reports/${id}`,
      'GET',
    );
    if (result.ok) setSource({ kind: 'report', report: result.report });
  };

  if (!rows || rows.length === 0) return null;

  return (
    <section className={`${styles.card} ${styles.followCard}`} aria-label="Kiểm kê của tôi">
      <strong>Kiểm kê của tôi</strong>
      <ul className={styles.requestList}>
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className={styles.invHistoryRow}
              aria-label={`${row.sheetName} ${row.date}`}
              onClick={() => void openReport(row.id)}
            >
              <span>
                {row.sheetName} · {row.date.slice(8)}/{row.date.slice(5, 7)}
                {row.shiftName ? ` · ${row.shiftName}` : ''}
                <span className={styles.timelineSub}>
                  {' '}
                  ·{' '}
                  {editableNow(row)
                    ? `sửa được tới ${formatClock(row.editableUntil!)}`
                    : `gửi ${formatClock(row.createdAt)}`}
                </span>
              </span>
              <span className={styles.invTags}>
                <MismatchTag count={row.mismatchCount} />
                <Tag color={INVENTORY_STATUS[row.status].color}>{INVENTORY_STATUS[row.status].label}</Tag>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <InventorySheet
        source={source}
        brandColor={brandColor}
        onClose={() => setSource(null)}
        onChanged={() => void load()}
      />
    </section>
  );
}
