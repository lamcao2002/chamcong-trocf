'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { App as AntdApp, ConfigProvider, Drawer, Dropdown, Menu, type MenuProps } from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CarryOutOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  ExportOutlined,
  IdcardOutlined,
  InboxOutlined,
  LeftOutlined,
  LogoutOutlined,
  RightOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useToast } from '@/components/common/useToast';
import { ROLE_LABELS, type Role } from '@/lib/auth/roles';
import {
  activeNavKey,
  initials,
  navForRole,
  type AdminNavItem,
  type AdminNavKey,
} from '@/lib/navigation/admin';
import { buildAntdTheme, themeCssVars } from '@/lib/theme/tokens';
import styles from './AdminShell.module.css';

const COLLAPSED_STORAGE_KEY = 'chamcong.admin.sidebarCollapsed';
/** Số mục nhảy thẳng trên thanh dưới; mục thứ 5 luôn là "Thêm". */
const BOTTOM_NAV_ITEMS = 4;

const ICONS: Record<AdminNavKey, ReactNode> = {
  inbox: <InboxOutlined />,
  timesheet: <CarryOutOutlined />,
  schedule: <CalendarOutlined />,
  payroll: <DollarOutlined />,
  staff: <TeamOutlined />,
  positions: <IdcardOutlined />,
  locations: <EnvironmentOutlined />,
  settings: <SettingOutlined />,
};

export type AdminViewer = {
  name: string;
  role: Role;
  companyName: string;
  brandColor: string | null;
};

type AdminShellProps = {
  viewer: AdminViewer;
  children: ReactNode;
};

function toMenuItems(items: AdminNavItem[]): MenuProps['items'] {
  const entry = ({ key, label, href }: AdminNavItem) => ({
    key,
    icon: ICONS[key],
    label: <Link href={href}>{label}</Link>,
  });
  const setup = items.filter((item) => item.group === 'setup').map(entry);
  return [
    ...items.filter((item) => item.group === 'main').map(entry),
    ...(setup.length > 0 ? [{ type: 'group' as const, label: 'THIẾT LẬP', children: setup }] : []),
  ];
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // Không lưu được thì lần sau mở lại menu đầy đủ
  }
}

/** Khung trang quản trị: menu trái từ 992px, thanh dưới + drawer "Thêm" dưới 992px. */
export function AdminShell({ viewer, children }: AdminShellProps) {
  const pathname = usePathname();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setCollapsed(readCollapsed()), []);
  useEffect(() => setMoreOpen(false), [pathname]);

  const toggleCollapsed = () => {
    writeCollapsed(!collapsed);
    setCollapsed(!collapsed);
  };

  const logout = async () => {
    const response = await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => null);
    if (response?.ok) {
      // Tải lại hẳn để người dùng sau không thấy trang còn trong cache của phiên này
      window.location.replace('/app/login');
    } else {
      toast.error('Không đăng xuất được, vui lòng thử lại');
    }
  };

  const items = navForRole(viewer.role);
  const menuItems = toMenuItems(items);
  const activeKey = activeNavKey(pathname);
  const selectedKeys = activeKey ? [activeKey] : [];
  const bottomItems = items.slice(0, BOTTOM_NAV_ITEMS);
  const moreActive = !bottomItems.some((item) => item.key === activeKey);

  const footerItems: MenuProps['items'] = [
    {
      key: 'employee-app',
      icon: <ExportOutlined />,
      label: (
        <a href="/m" target="_blank" rel="noreferrer">
          App nhân viên
        </a>
      ),
    },
    {
      key: 'collapse',
      icon: collapsed ? <RightOutlined /> : <LeftOutlined />,
      label: collapsed ? 'Mở rộng menu' : 'Thu gọn menu',
      onClick: toggleCollapsed,
    },
  ];

  const companyCard = (
    <div className={styles.company}>
      <span className={styles.logo} aria-hidden>
        {viewer.companyName.trim().charAt(0).toUpperCase()}
      </span>
      <span className={styles.companyName}>{viewer.companyName}</span>
    </div>
  );

  return (
    <ConfigProvider theme={buildAntdTheme(viewer.brandColor ?? undefined)}>
      {/* App riêng để toast và hộp xác nhận nhận màu công ty thay vì màu mặc định ở Providers */}
      <AntdApp component={false} message={{ top: 16, maxCount: 3 }}>
        <div
          className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}
          style={themeCssVars(viewer.brandColor ?? undefined) as CSSProperties}
        >
          <aside className={styles.sidebar} aria-label="Menu quản trị">
            {companyCard}
            <nav className={styles.sidebarNav}>
              <Menu
                mode="inline"
                inlineCollapsed={collapsed}
                selectedKeys={selectedKeys}
                items={menuItems}
                style={{ border: 0 }}
              />
            </nav>
            <div className={styles.sidebarFooter}>
              <Menu
                mode="inline"
                inlineCollapsed={collapsed}
                selectable={false}
                items={footerItems}
                style={{ border: 0 }}
              />
            </div>
          </aside>

          <div className={styles.main}>
            <div className={styles.account}>
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{
                  items: [
                    { key: 'who', disabled: true, label: `${viewer.name} · ${ROLE_LABELS[viewer.role]}` },
                    { type: 'divider' },
                    {
                      key: 'logout',
                      icon: <LogoutOutlined />,
                      label: 'Đăng xuất',
                      onClick: () => void logout(),
                    },
                  ],
                }}
              >
                <button type="button" className={styles.avatar} aria-label={`Tài khoản ${viewer.name}`}>
                  {initials(viewer.name)}
                </button>
              </Dropdown>
            </div>
            <main>{children}</main>
          </div>

          <nav className={styles.bottomNav} aria-label="Điều hướng chính">
            {bottomItems.map(({ key, label, href }) => {
              const active = key === activeKey;
              return (
                <Link
                  key={key}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`${styles.bottomItem} ${active ? styles.bottomItemActive : ''}`}
                >
                  <span className={styles.bottomIcon}>{ICONS[key]}</span>
                  {label}
                </Link>
              );
            })}
            <button
              type="button"
              className={`${styles.bottomItem} ${moreActive ? styles.bottomItemActive : ''}`}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
            >
              <span className={styles.bottomIcon}>
                <AppstoreOutlined />
              </span>
              Thêm
            </button>
          </nav>

          <Drawer
            placement="left"
            width={280}
            title="Menu"
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            styles={{ body: { padding: 0 } }}
          >
            <div
              className={styles.drawerNav}
              style={themeCssVars(viewer.brandColor ?? undefined) as CSSProperties}
            >
              {companyCard}
              <nav aria-label="Toàn bộ menu">
                <Menu mode="inline" selectedKeys={selectedKeys} items={menuItems} style={{ border: 0 }} />
              </nav>
            </div>
          </Drawer>
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}
