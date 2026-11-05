'use client';

import { useState } from 'react';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { downloadFile } from '@/lib/api/client';
import { useToast } from './useToast';

/** Tải file qua fetch thay vì thẻ link, để lỗi hiện thành toast thay vì một trang JSON. */
type ExportButtonProps = { url: string; label?: string; className?: string };

export function ExportButton({ url, label = 'Xuất Excel', className }: ExportButtonProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const result = await downloadFile(url);
    setLoading(false);
    if (!result.ok) toast.error(result.error);
  };

  return (
    <Button className={className} icon={<DownloadOutlined />} loading={loading} onClick={() => void run()}>
      {label}
    </Button>
  );
}
