'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input, Modal, Select, Table } from 'antd';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { inviteLink, inviteMessage } from '@/lib/domain/invite';
import {
  MAX_IMPORT_ROWS,
  parseStaffLines,
  reviewStaffLines,
  type ImportRow,
} from '@/lib/domain/staff-import';
import type { EmployeeView } from '@/lib/services/employees';
import type { PositionView } from '@/lib/services/positions';
import styles from './config.module.css';

type Created = { id: string; name: string; email: string; pin: string };

type BulkAddModalProps = {
  open: boolean;
  companyCode: string;
  employees: EmployeeView[];
  positions: PositionView[];
  onClose: () => void;
};

const PLACEHOLDER = 'Nguyễn Văn An, an@quan.vn, Pha chế\nTrần Thị Bình; binh@quan.vn; Phục vụ';

/**
 * Thêm hàng loạt: dán danh sách, xem trước từng dòng, rồi hiện PIN của cả lô một lần duy nhất (STF-10).
 * Modal của AntD giữ nội dung trong DOM sau khi đóng, nên phải `destroyOnHidden` để PIN không nằm lại.
 */
export function BulkAddModal({ open, companyCode, employees, positions, onClose }: BulkAddModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState('');
  const [fallback, setFallback] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<number, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Created[] | null>(null);

  const positionOptions = positions.map(({ id, name }) => ({ value: id, label: name }));
  const rows = useMemo(
    () => reviewStaffLines(parseStaffLines(text), positions, new Set(employees.map(({ email }) => email))),
    [text, positions, employees],
  );
  const positionOf = (row: ImportRow) =>
    row.line in chosen ? chosen[row.line]! : (row.positionId ?? fallback);
  const ready = rows.filter(({ error }) => !error);
  const tooMany = ready.length > MAX_IMPORT_ROWS;

  const reset = () => {
    setText('');
    setFallback(null);
    setChosen({});
    setCreated(null);
  };

  const close = () => {
    if (created) router.refresh();
    reset();
    onClose();
  };

  const submit = async () => {
    setSaving(true);
    const result = await apiRequest<{ employees: Created[] }>('/api/v1/employees/bulk', 'POST', {
      employees: ready.map((row) => ({ name: row.name, email: row.email, positionId: positionOf(row) })),
    });
    setSaving(false);
    if (result.ok) setCreated(result.employees);
    else toast.error(result.error);
  };

  const copyAll = async () => {
    const link = inviteLink(window.location.origin, companyCode);
    const messages = created!.map((person) => inviteMessage({ ...person, link, companyCode }));
    try {
      await navigator.clipboard.writeText(messages.join('\n\n'));
      toast.success(`Đã chép tin cho ${messages.length} người.`);
    } catch {
      toast.error('Không chép được, hãy ghi lại PIN.');
    }
  };

  if (created) {
    return (
      <Modal
        open={open}
        title={`Đã thêm ${created.length} người`}
        closable={false}
        maskClosable={false}
        keyboard={false}
        destroyOnHidden
        footer={[
          <Button key="copy" onClick={() => void copyAll()}>
            Chép tin cho cả {created.length} người
          </Button>,
          <Button key="done" type="primary" onClick={close}>
            Đã lưu PIN, đóng
          </Button>,
        ]}
      >
        <Alert
          type="warning"
          style={{ marginBottom: 12 }}
          message="PIN chỉ hiện một lần. Đóng cửa sổ này là không xem lại được, chỉ có thể đặt lại PIN."
        />
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={created}
          columns={[
            { title: 'Họ tên', dataIndex: 'name' },
            { title: 'Email', dataIndex: 'email' },
            { title: 'PIN', dataIndex: 'pin', render: (pin: string) => <strong>{pin}</strong> },
          ]}
          scroll={{ x: true, y: 320 }}
        />
      </Modal>
    );
  }

  const skipped = rows.length - ready.length;

  return (
    <Modal
      open={open}
      width={760}
      destroyOnHidden
      title="Thêm hàng loạt"
      onCancel={close}
      okText={`Thêm ${ready.length} người`}
      cancelText="Huỷ"
      confirmLoading={saving}
      okButtonProps={{ disabled: ready.length === 0 || tooMany }}
      onOk={() => void submit()}
    >
      <p className={styles.muted}>
        Mỗi dòng: Họ tên, email, vị trí. Dùng dấu phẩy, chấm phẩy hoặc dán thẳng 3 cột từ Excel. Mỗi người
        được tạo PIN 4 số; ngày vào làm là hôm nay, sửa sau trong hồ sơ.
      </p>
      <Input.TextArea
        rows={5}
        aria-label="Danh sách nhân viên"
        placeholder={PLACEHOLDER}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setChosen({});
        }}
      />
      {rows.length > 0 ? (
        <>
          <div className={styles.bulkSummary}>
            <span>
              {ready.length} người sẵn sàng{skipped > 0 ? `, ${skipped} dòng bỏ qua` : ''}.
            </span>
            <label>
              Dòng thiếu vị trí dùng{' '}
              <Select
                allowClear
                size="small"
                placeholder="Không gán"
                aria-label="Vị trí cho dòng thiếu vị trí"
                value={fallback}
                options={positionOptions}
                onChange={(value) => setFallback(value ?? null)}
                style={{ minWidth: 140 }}
              />
            </label>
          </div>
          {tooMany ? (
            <Alert
              type="error"
              style={{ marginBottom: 8 }}
              message={`Mỗi lần thêm tối đa ${MAX_IMPORT_ROWS} người, hãy chia nhỏ danh sách.`}
            />
          ) : null}
          <Table
            size="small"
            rowKey="line"
            pagination={false}
            dataSource={rows}
            rowClassName={({ error }) => (error ? (styles.bulkError ?? '') : '')}
            scroll={{ y: 280 }}
            columns={[
              { title: '#', dataIndex: 'line', width: 44 },
              {
                title: 'Nhân viên',
                render: (_value, { name, email, error }) => (
                  <span className={styles.bulkCell}>
                    <span className={styles.bulkPerson}>{name || 'Chưa có họ tên'}</span>
                    <span className={styles.muted}>{email || 'Chưa có email'}</span>
                    {error ? <strong className={styles.bulkReason}>{error}</strong> : null}
                  </span>
                ),
              },
              {
                title: 'Vị trí',
                width: 132,
                render: (_value, row) => (
                  <Select
                    allowClear
                    size="small"
                    placeholder="Không gán"
                    aria-label={`Vị trí dòng ${row.line}`}
                    disabled={Boolean(row.error)}
                    value={positionOf(row)}
                    options={positionOptions}
                    onChange={(value) => setChosen((rest) => ({ ...rest, [row.line]: value ?? null }))}
                    style={{ width: '100%' }}
                  />
                ),
              },
            ]}
          />
        </>
      ) : null}
    </Modal>
  );
}
