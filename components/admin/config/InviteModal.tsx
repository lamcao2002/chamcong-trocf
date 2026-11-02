'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Space, Typography } from 'antd';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { useToast } from '@/components/common/useToast';
import { inviteLink, inviteMessage } from '@/lib/domain/invite';
import { normalizeName } from '@/lib/domain/staff-import';
import type { EmployeeView } from '@/lib/services/employees';
import styles from './config.module.css';

const QR_SIZE = 240;

type InviteModalProps = {
  open: boolean;
  companyCode: string;
  employees: EmployeeView[];
  onClose: () => void;
};

/** Gửi link cài app: QR, link và tin nhắn mẫu từng người. PIN chỉ có lúc vừa tạo hoặc đặt lại (STF-11). */
export function InviteModal({ open, companyCode, employees, onClose }: InviteModalProps) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [qr, setQr] = useState<string>();
  const [origin] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin));
  const link = inviteLink(origin, companyCode);

  useEffect(() => {
    if (!open || !origin) return;
    void import('qrcode').then(({ toDataURL }) => toDataURL(link, { width: QR_SIZE, margin: 1 })).then(setQr);
  }, [open, origin, link]);

  const active = useMemo(() => employees.filter(({ status }) => status === 'active'), [employees]);
  const term = normalizeName(search);
  const rows = active.filter(({ name, email }) => normalizeName(`${name} ${email}`).includes(term));

  const messageFor = ({ name, email }: EmployeeView) => inviteMessage({ name, email, link, companyCode });

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error('Không chép được, hãy chọn chữ rồi chép tay.');
    }
  };

  return (
    <Modal open={open} title="Gửi link cài app" footer={null} onCancel={onClose} destroyOnHidden>
      <div className={styles.invite}>
        {qr ? (
          // Ảnh QR là data URL tạo tại chỗ, `next/image` không có gì để tối ưu
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.qr} src={qr} width={QR_SIZE} height={QR_SIZE} alt="Mã QR cài app" />
        ) : (
          <div className={styles.qr} aria-hidden />
        )}
        <p className={styles.muted}>
          Nhân viên quét mã hoặc mở link này. Mã công ty: <strong>{companyCode}</strong>
        </p>
        <Space.Compact style={{ width: '100%' }}>
          <Input value={link} readOnly aria-label="Link cài app" />
          <Button icon={<CopyOutlined />} onClick={() => void copy(link, 'Đã chép link.')}>
            Chép link
          </Button>
        </Space.Compact>
        <Button icon={<DownloadOutlined />} href={qr} download="qr-cai-app.png" disabled={!qr}>
          Tải ảnh QR
        </Button>
      </div>

      <div className={styles.inviteHead}>
        <strong>Tin nhắn mẫu cho từng người</strong>
        <Button
          size="small"
          disabled={active.length === 0}
          onClick={() =>
            void copy(active.map(messageFor).join('\n\n'), `Đã chép tin cho ${active.length} người.`)
          }
        >
          Chép tin cho cả {active.length} người
        </Button>
      </div>
      <Typography.Paragraph type="secondary">
        Tin nhắn ở đây không kèm PIN vì hệ thống chỉ lưu PIN đã mã hoá. Cần PIN thì dùng Đặt lại PIN trong hồ
        sơ, hoặc giao PIN lúc thêm người.
      </Typography.Paragraph>
      <Input
        allowClear
        placeholder="Tìm người"
        aria-label="Tìm người"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <ul className={styles.inviteList}>
        {rows.map((employee) => (
          <li key={employee.id}>
            <span className={styles.rowBody}>
              <span className={styles.rowName}>{employee.name}</span>
              <span className={styles.muted}>{employee.email}</span>
            </span>
            <Button size="small" onClick={() => void copy(messageFor(employee), 'Đã chép tin nhắn.')}>
              Chép tin nhắn
            </Button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
