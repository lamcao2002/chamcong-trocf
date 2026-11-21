'use client';

import { useState } from 'react';
import { Button, ConfigProvider } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useLogout } from '@/components/common/useLogout';
import { ROLE_LABELS, type Role } from '@/lib/auth/roles';
import type { AppHome } from '@/lib/services/attendance';
import type { MyRequestView } from '@/lib/services/requests';
import { buildAntdTheme } from '@/lib/theme/tokens';
import { EmployeeNav, useHashTab } from './EmployeeNav';
import { InventorySheet, type InventorySource } from './InventorySheet';
import { NotificationBell } from './NotificationBell';
import { PayslipTab } from './PayslipTab';
import { ProfileTab } from './ProfileTab';
import { PunchScreen } from './PunchScreen';
import { RequestSheet } from './RequestSheet';
import { ScheduleTab } from './ScheduleTab';
import styles from './EmployeeScreen.module.css';

type EmployeeHomeProps = {
  name: string;
  role: Role;
  companyName: string;
  brandColor: string | null;
  home: AppHome;
};

/** Màn chính của app nhân viên: dải đầu trang và màn Chấm công. */
export function EmployeeHome({ name, role, companyName, brandColor, home }: EmployeeHomeProps) {
  const logout = useLogout('/m');
  const tab = useHashTab();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [requestsKey, setRequestsKey] = useState(0);
  const [editing, setEditing] = useState<MyRequestView | null>(null);
  const [inventory, setInventory] = useState<InventorySource | null>(null);
  const reload = () => setRequestsKey((key) => key + 1);

  return (
    <>
      <header className={styles.band}>
        <div className={styles.inner}>
          <div>
            <p className={styles.greeting}>{name}</p>
            <p className={styles.sub}>
              {ROLE_LABELS[role]} · {companyName}
            </p>
          </div>
          <div className={styles.headerActions}>
            <NotificationBell brandColor={brandColor} />
            <Button icon={<LogoutOutlined />} aria-label="Đăng xuất" onClick={() => void logout()} />
          </div>
        </div>
      </header>
      {/* Chip ca và nút theo màu công ty, thay vì màu mặc định của Providers */}
      <ConfigProvider theme={buildAntdTheme(brandColor ?? undefined)}>
        {/* Ẩn chứ không gỡ: màn Chấm công giữ GPS và đồng hồ khi chuyển tab */}
        <div hidden={tab !== 'cham'}>
          <PunchScreen home={home} brandColor={brandColor} reloadKey={requestsKey} />
        </div>
        {tab === 'lich' ? <ScheduleTab brandColor={brandColor} /> : null}
        {tab === 'luong' ? <PayslipTab brandColor={brandColor} /> : null}
        {tab === 'toi' ? (
          <ProfileTab
            brandColor={brandColor}
            reloadKey={requestsKey}
            onEdit={(request) => {
              setEditing(request);
              setSheetOpen(true);
            }}
            onChanged={() => setRequestsKey((key) => key + 1)}
          />
        ) : null}
        <EmployeeNav
          tab={tab}
          onCreate={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        />
        <RequestSheet
          open={sheetOpen}
          choices={home.choices}
          brandColor={brandColor}
          editing={editing}
          onClose={() => setSheetOpen(false)}
          onSent={reload}
          onInventory={(source) => {
            // Bảng đếm là sheet riêng có nút gửi riêng: đóng Tạo đơn rồi mở bảng đếm
            setSheetOpen(false);
            setInventory(source);
          }}
        />
        <InventorySheet
          source={inventory}
          brandColor={brandColor}
          onClose={() => setInventory(null)}
          onChanged={reload}
        />
      </ConfigProvider>
    </>
  );
}
