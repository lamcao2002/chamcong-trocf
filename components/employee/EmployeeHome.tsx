'use client';

import { Button, ConfigProvider } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useLogout } from '@/components/common/useLogout';
import { ROLE_LABELS, type Role } from '@/lib/auth/roles';
import type { AppHome } from '@/lib/services/attendance';
import { buildAntdTheme } from '@/lib/theme/tokens';
import { PunchScreen } from './PunchScreen';
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
          <Button icon={<LogoutOutlined />} aria-label="Đăng xuất" onClick={() => void logout()} />
        </div>
      </header>
      {/* Chip ca và nút theo màu công ty, thay vì màu mặc định của Providers */}
      <ConfigProvider theme={buildAntdTheme(brandColor ?? undefined)}>
        <PunchScreen home={home} />
      </ConfigProvider>
    </>
  );
}
