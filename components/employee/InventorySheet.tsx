'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Drawer, Grid, Input, InputNumber, Tag } from 'antd';
import { CloseOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { useConfirmDiscard } from '@/components/common/useConfirmDiscard';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { groupByKind, isMismatch, MAX_QUANTITY, quantityDiff } from '@/lib/domain/inventory';
import { formatClock, formatDate, formatDecimal } from '@/lib/format';
import type { InventoryItemView, InventoryReportDetail } from '@/lib/services/inventory';
import { themeCssVars, tokens } from '@/lib/theme/tokens';
import { missingReasons } from '@/lib/validation/inventory';
import styles from './EmployeeScreen.module.css';

export const INVENTORY_STATUS: Record<InventoryReportDetail['status'], { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'default' },
  approved: { label: 'Đã duyệt', color: 'success' },
  rejected: { label: 'Từ chối', color: 'error' },
};

export function MismatchTag({ count }: { count: number }) {
  return count > 0 ? <Tag color="error">{count} món lệch</Tag> : <Tag color="success">Khớp hết</Tag>;
}

/** Mở để đếm mới một phiếu của ca, hoặc xem, sửa một lần đã gửi. */
export type InventorySource =
  | { kind: 'new'; sheetId: string; sheetName: string; shiftName: string | null; items: InventoryItemView[] }
  | { kind: 'report'; report: InventoryReportDetail };

type Row = {
  key: string;
  kind: InventoryItemView['kind'];
  name: string;
  unit: string;
  expected: number;
  hint: string | null;
};
type Entry = { counted: number | null; note: string };

function rowsOf(source: InventorySource): Row[] {
  if (source.kind === 'new') {
    return source.items.map(({ id, kind, name, unit, quantity, note }) => ({
      key: id,
      kind,
      name,
      unit,
      expected: quantity,
      hint: note,
    }));
  }
  return source.report.lines.map(({ id, kind, name, unit, expected }) => ({
    key: id,
    kind,
    name,
    unit,
    expected,
    hint: null,
  }));
}

function entriesOf(source: InventorySource): Record<string, Entry> {
  if (source.kind === 'new') return {};
  return Object.fromEntries(
    source.report.lines.map(({ id, counted, note }) => [id, { counted, note: note ?? '' }]),
  );
}

type InventorySheetProps = {
  source: InventorySource | null;
  brandColor: string | null;
  onClose: () => void;
  /** Đã gửi, sửa hoặc xoá: tải lại thẻ và danh sách. */
  onChanged: () => void;
};

export function InventorySheet({ source, brandColor, onClose, onChanged }: InventorySheetProps) {
  const toast = useToast();
  const confirm = useConfirmDiscard();
  const desktop = Grid.useBreakpoint().lg ?? false;
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const asking = useRef(false);

  useEffect(() => {
    if (!source) return;
    setEntries(entriesOf(source));
    setErrors({});
    setDirty(false);
  }, [source]);

  if (!source) return null;
  const rows = rowsOf(source);
  const report = source.kind === 'report' ? source.report : null;
  const editable =
    !report || (report.editableUntil !== null && Date.parse(report.editableUntil) > Date.now());
  const entryOf = (key: string): Entry => entries[key] ?? { counted: null, note: '' };
  const offCount = rows.filter(({ key, expected }) => {
    const { counted } = entryOf(key);
    return counted !== null && isMismatch(expected, counted);
  }).length;
  const missing = rows.filter(({ key }) => entryOf(key).counted === null).length;

  const change = (key: string, patch: Partial<Entry>) => {
    setEntries((current) => ({ ...current, [key]: { ...entryOf(key), ...current[key], ...patch } }));
    setErrors(({ [key]: _cleared, ...rest }) => rest);
    setDirty(true);
  };

  const requestClose = async () => {
    if (saving || asking.current) return;
    if (dirty && editable) {
      asking.current = true;
      const confirmed = await confirm();
      asking.current = false;
      if (!confirmed) return;
    }
    onClose();
  };

  const submit = async () => {
    if (missing > 0) {
      setErrors(
        Object.fromEntries(
          rows.filter(({ key }) => entryOf(key).counted === null).map(({ key }) => [key, 'Nhập số đếm']),
        ),
      );
      toast.error(`Còn ${missing} món chưa nhập số đếm`);
      return;
    }
    const lines = rows.map(({ key, expected }) => ({
      key,
      expected,
      ...entryOf(key),
      counted: entryOf(key).counted!,
    }));
    const local = missingReasons(lines);
    const byIndex = (fields: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(fields).flatMap(([field, message]) => {
          const index = Number(field.split('.')[1]);
          return rows[index] ? [[rows[index].key, message]] : [];
        }),
      );
    if (Object.keys(local).length > 0) {
      setErrors(byIndex(local));
      toast.error('Ghi lý do cho các món bị lệch');
      return;
    }

    const body = lines.map(({ key, counted, note }) => ({
      ...(report ? { id: key } : { itemId: key }),
      counted,
      note: note.trim() || null,
    }));
    setSaving(true);
    const result = report
      ? await apiRequest(`/api/v1/app/inventory/reports/${report.id}`, 'PATCH', { lines: body })
      : await apiRequest('/api/v1/app/inventory', 'POST', {
          sheetId: source.kind === 'new' ? source.sheetId : '',
          lines: body,
        });
    setSaving(false);
    if (!result.ok) {
      if (result.fields) setErrors(byIndex(result.fields));
      toast.error(result.error);
      return;
    }
    toast.success(report ? 'Đã lưu kiểm kê' : 'Đã gửi kiểm kê');
    setDirty(false);
    onClose();
    onChanged();
  };

  const remove = async () => {
    if (!report) return;
    const confirmed = await confirm({
      title: 'Xoá báo cáo kiểm kê này?',
      content: 'Quản lý không còn thấy báo cáo. Bạn vẫn kiểm kê lại được nếu còn trong ca.',
      okText: 'Xoá báo cáo',
    });
    if (!confirmed) return;
    setSaving(true);
    const result = await apiRequest(`/api/v1/app/inventory/reports/${report.id}`, 'DELETE');
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      onChanged();
      return;
    }
    toast.success('Đã xoá báo cáo kiểm kê');
    setDirty(false);
    onClose();
    onChanged();
  };

  const sheetName = report ? report.sheetName : source.kind === 'new' ? source.sheetName : '';
  const shiftName = report ? report.shiftName : source.kind === 'new' ? source.shiftName : null;
  const subtitle = report
    ? `${formatDate(report.date)}${shiftName ? ` · ${shiftName}` : ''} · gửi ${formatClock(report.createdAt)}`
    : `${shiftName ?? 'Ca đang làm'} · ${rows.length} món`;

  return (
    <Drawer
      open
      placement={desktop ? 'right' : 'bottom'}
      width={desktop ? tokens.formDrawerWidth : '100%'}
      height="calc(100% - 24px)"
      closable={false}
      destroyOnHidden
      onClose={() => void requestClose()}
      rootStyle={themeCssVars(brandColor ?? undefined)}
      rootClassName={styles.sheetRoot}
      title={null}
      footer={
        editable ? (
          <div className={styles.invFooter}>
            {report ? (
              <Button
                danger
                size="large"
                shape="round"
                icon={<DeleteOutlined />}
                disabled={saving}
                onClick={() => void remove()}
              >
                Xoá
              </Button>
            ) : null}
            <Button
              block
              type="primary"
              size="large"
              shape="round"
              icon={<SendOutlined />}
              loading={saving}
              onClick={() => void submit()}
            >
              {report ? 'Lưu thay đổi' : offCount > 0 ? `Gửi kiểm kê · ${offCount} món lệch` : 'Gửi kiểm kê'}
            </Button>
          </div>
        ) : null
      }
      styles={{ footer: { padding: '12px 16px max(12px, env(safe-area-inset-bottom))' } }}
    >
      <span className={styles.sheetGrip} aria-hidden />
      <div className={styles.sheetHead}>
        <div>
          <h2 className={styles.sheetTitle}>{sheetName}</h2>
          <p className={styles.muted}>{subtitle}</p>
        </div>
        <button
          type="button"
          className={styles.sheetClose}
          aria-label="Đóng"
          onClick={() => void requestClose()}
        >
          <CloseOutlined />
        </button>
      </div>

      {report ? (
        <div className={styles.invStatus}>
          <Tag color={INVENTORY_STATUS[report.status].color}>{INVENTORY_STATUS[report.status].label}</Tag>
          <MismatchTag count={report.mismatchCount} />
          {editable ? (
            <span className={styles.muted}>Sửa, xoá được tới {formatClock(report.editableUntil!)}</span>
          ) : null}
          {report.decisionNote ? (
            <p className={styles.resultLine}>Quản lý ghi: {report.decisionNote}</p>
          ) : null}
        </div>
      ) : (
        <p className={styles.muted}>
          Đếm từng món rồi nhập số. Số khác số hiện có thì dòng báo đỏ, ghi lý do lệch.
        </p>
      )}

      {groupByKind(rows).map(({ kind: group, label, rows: groupRows }, _index, groups) => (
        <section key={group} aria-label={label}>
          {groups.length > 1 ? <h3 className={styles.invGroup}>{label}</h3> : null}
          <ul className={styles.invList}>
            {groupRows.map(({ key, name, unit, expected, hint }) => {
              const { counted, note } = entryOf(key);
              const off = counted !== null && isMismatch(expected, counted);
              return (
                <li key={key} className={off ? styles.invOff : undefined}>
                  <div className={styles.invHead}>
                    <strong>{name}</strong>
                    <span className={styles.invExpected}>
                      Hiện có {formatDecimal(expected)} {unit}
                    </span>
                  </div>
                  {hint ? <p className={styles.invHint}>{hint}</p> : null}
                  {editable ? (
                    <div className={styles.invInput}>
                      <InputNumber
                        min={0}
                        max={MAX_QUANTITY}
                        decimalSeparator=","
                        inputMode="decimal"
                        value={counted}
                        status={errors[key] && counted === null ? 'error' : undefined}
                        aria-label={`Số đếm ${name}`}
                        placeholder="Số đếm"
                        addonAfter={unit}
                        onChange={(value) =>
                          change(key, { counted: typeof value === 'number' ? value : null })
                        }
                        style={{ flex: 1 }}
                      />
                      <Button
                        aria-label={`${name} đủ ${formatDecimal(expected)}`}
                        onClick={() => change(key, { counted: expected })}
                      >
                        Đủ
                      </Button>
                    </div>
                  ) : (
                    <p className={styles.invCounted}>
                      Đếm được <strong>{counted === null ? '—' : formatDecimal(counted)}</strong> {unit}
                    </p>
                  )}
                  {off ? (
                    <>
                      <p className={styles.invDiff}>
                        {quantityDiff(expected, counted) < 0 ? 'Thiếu' : 'Dư'}{' '}
                        {formatDecimal(Math.abs(quantityDiff(expected, counted)))} {unit}
                      </p>
                      {editable ? (
                        <Input.TextArea
                          rows={2}
                          maxLength={200}
                          value={note}
                          status={errors[key] ? 'error' : undefined}
                          aria-label={`Lý do lệch ${name}`}
                          placeholder="Lý do lệch: vỡ, hết, khách mượn…"
                          onChange={(event) => change(key, { note: event.target.value })}
                        />
                      ) : (
                        <p className={styles.invHint}>Lý do: {note || '—'}</p>
                      )}
                    </>
                  ) : null}
                  {errors[key] ? <p className={styles.invError}>{errors[key]}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Drawer>
  );
}
