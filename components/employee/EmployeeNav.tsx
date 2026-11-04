'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  CalendarOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import styles from './EmployeeScreen.module.css';

export type EmployeeTab = 'cham' | 'lich' | 'luong' | 'toi';

const TAB_OF_HASH: Record<string, EmployeeTab> = { '#/lich': 'lich', '#/luong': 'luong', '#/toi': 'toi' };

/** Tab đọc từ hash của URL (`/m#/lich`): chuyển phía client, không tải lại trang. */
export function useHashTab(): EmployeeTab {
  const [tab, setTab] = useState<EmployeeTab>('cham');

  useEffect(() => {
    const read = () => setTab(TAB_OF_HASH[window.location.hash] ?? 'cham');
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  return tab;
}

const ITEMS: { tab: EmployeeTab; label: string; href: string; icon: ReactNode }[] = [
  { tab: 'cham', label: 'Chấm công', href: '#/', icon: <EnvironmentOutlined /> },
  { tab: 'lich', label: 'Lịch & công', href: '#/lich', icon: <CalendarOutlined /> },
  { tab: 'luong', label: 'Lương', href: '#/luong', icon: <DollarOutlined /> },
  { tab: 'toi', label: 'Tôi', href: '#/toi', icon: <UserOutlined /> },
];

type EmployeeNavProps = { tab: EmployeeTab; onCreate: () => void };

/** Thanh dưới app nhân viên: hai tab mỗi bên để nút "+" mở sheet Tạo đơn nằm đúng giữa. */
export function EmployeeNav({ tab, onCreate }: EmployeeNavProps) {
  const link = ({ tab: key, label, href, icon }: (typeof ITEMS)[number]) => (
    <a
      key={key}
      href={href}
      aria-current={key === tab ? 'page' : undefined}
      className={`${styles.navItem} ${key === tab ? styles.navActive : ''}`}
    >
      <span className={styles.navIcon}>{icon}</span>
      {label}
    </a>
  );

  return (
    <nav className={styles.nav} aria-label="Điều hướng chính">
      {ITEMS.slice(0, 2).map(link)}
      <button type="button" className={styles.navCreate} aria-label="Tạo đơn" onClick={onCreate}>
        <PlusOutlined />
      </button>
      {ITEMS.slice(2).map(link)}
    </nav>
  );
}
