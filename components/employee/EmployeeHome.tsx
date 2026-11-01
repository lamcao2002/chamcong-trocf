'use client';

import { Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useLogout } from '@/components/common/useLogout';
import { ROLE_LABELS, type Role } from '@/lib/auth/roles';
import styles from './EmployeeScreen.module.css';

type EmployeeHomeProps = {
  name: string;
  role: Role;
  companyName: string;
};

/** Màn tạm sau khi đăng nhập; M2 Chấm công thay ở Sprint 2 (US17–US20). */
export function EmployeeHome({ name, role, companyName }: EmployeeHomeProps) {
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
      <main className={styles.body}>
        <div className={styles.card}>
          <h1 className={styles.title}>Chấm công</h1>
          <p className={styles.muted}>Màn chấm công sẽ có ở Sprint 2.</p>
        </div>
      </main>
    </>
  );
}
