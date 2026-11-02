'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Badge, Button, Drawer, Empty, Skeleton } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { apiRequest } from '@/lib/api/client';
import { formatClock, formatDate } from '@/lib/format';
import type { NotificationView } from '@/lib/services/notifications';
import { vietnamToday } from '@/lib/domain/date';
import { themeCssVars } from '@/lib/theme/tokens';
import styles from './EmployeeScreen.module.css';

type Feed = { notifications: NotificationView[]; unread: number };

const when = (createdAt: Date) => {
  const date = vietnamToday(new Date(createdAt));
  return `${formatClock(createdAt)} ${formatDate(date).slice(0, 5)}`;
};

/** Thông báo trong app (EMP-17): tải lại khi quay về app, vì chưa có web push. */
export function NotificationBell({ brandColor }: { brandColor: string | null }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const result = await apiRequest<Feed>('/api/v1/app/notifications', 'GET');
    if (result.ok) setFeed(result);
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [load]);

  const show = async () => {
    setOpen(true);
    await load();
    await apiRequest('/api/v1/app/notifications/read', 'POST', {});
    setFeed((current) => (current ? { ...current, unread: 0 } : current));
  };

  const close = () => {
    setOpen(false);
    void load();
  };

  const unread = feed?.unread ?? 0;
  return (
    <>
      <Badge count={unread} size="small" overflowCount={9}>
        <Button
          icon={<BellOutlined />}
          aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
          onClick={() => void show()}
        />
      </Badge>
      <Drawer open={open} title="Thông báo" placement="bottom" height="80%" destroyOnHidden onClose={close}>
        {/* Drawer nằm ngoài vùng đặt biến CSS của màn */}
        <div style={themeCssVars(brandColor ?? undefined) as CSSProperties}>
          {!feed ? <Skeleton active paragraph={{ rows: 3 }} title={false} /> : null}
          {feed?.notifications.length === 0 ? <Empty description="Chưa có thông báo nào" /> : null}
          <ul className={styles.notifications}>
            {feed?.notifications.map(({ id, title, body, href, readAt, createdAt }) => (
              <li key={id}>
                <a href={href} className={readAt ? '' : styles.notificationNew} onClick={close}>
                  <strong>{title}</strong>
                  <span>{body}</span>
                  <span className={styles.notificationTime}>{when(createdAt)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Drawer>
    </>
  );
}
