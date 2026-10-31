'use client';

import { Card, Result } from 'antd';
import { tokens } from '@/lib/theme/tokens';

/** Nội dung tạm của trang quản trị chưa làm; mỗi việc sau thay bằng màn thật. */
export function ComingSoon({ task }: { task: string }) {
  return (
    <Card style={{ boxShadow: tokens.shadowCard }}>
      <Result status="info" title="Màn này chưa làm" subTitle={`Sẽ có ở ${task}.`} />
    </Card>
  );
}
