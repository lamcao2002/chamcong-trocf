'use client';

import { useState } from 'react';
import { Button, ConfigProvider } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useLogout } from '@/components/common/useLogout';
import { ROLE_LABELS, type Role } from '@/lib/auth/roles';
import type { AppHome } from '@/lib/services/attendance';
import { buildAntdTheme } from '@/lib/theme/tokens';
import { EmployeeNav, useHashTab } from './EmployeeNav';
import { NotificationBell } from './NotificationBell';
import { PayslipTab } from './PayslipTab';
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
          <PunchScreen home={home} />
        </div>
        {tab === 'lich' ? (
          <ScheduleTab
            requestsKey={requestsKey}
            brandColor={brandColor}
            onChanged={() => setRequestsKey((key) => key + 1)}
          />
        ) : null}
        {tab === 'luong' ? <PayslipTab brandColor={brandColor} /> : null}
        <EmployeeNav tab={tab} onCreate={() => setSheetOpen(true)} />
        <RequestSheet
          open={sheetOpen}
          choices={home.choices}
          onClose={() => setSheetOpen(false)}
          onSent={() => setRequestsKey((key) => key + 1)}
        />
      </ConfigProvider>
    </>
  );
}
