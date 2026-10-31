'use client';

import { Card, Result, Tag, Typography } from 'antd';
import { DEFAULT_BRAND, headerGradient, tokens } from '@/lib/theme/tokens';

type PlaceholderScreenProps = {
  title: string;
  subtitle: string;
  nextTask: string;
};

/** Màn hình tạm cho Sprint 1, thay bằng màn thật ở S1-05 trở đi. */
export function PlaceholderScreen({ title, subtitle, nextTask }: PlaceholderScreenProps) {
  return (
    <main style={{ minHeight: '100vh' }}>
      <header
        style={{
          background: headerGradient(DEFAULT_BRAND),
          color: '#fff',
          padding: '24px 18px 96px',
        }}
      >
        <Typography.Title level={3} style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 700 }}>
          {title}
        </Typography.Title>
        <Typography.Text style={{ color: 'rgba(255,255,255,.85)' }}>{subtitle}</Typography.Text>
      </header>
      <div style={{ maxWidth: 720, margin: '-72px auto 0', padding: '0 18px' }}>
        <Card style={{ boxShadow: tokens.shadowCard }}>
          <Result
            status="info"
            title="Khung dự án đã sẵn sàng"
            subTitle={`Việc tiếp theo: ${nextTask}`}
            extra={<Tag color="green">Sprint 1</Tag>}
          />
        </Card>
      </div>
    </main>
  );
}
