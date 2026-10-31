import type { Metadata } from 'next';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default function AdminLoginPage() {
  return (
    <PlaceholderScreen
      title="Đăng nhập quản trị"
      subtitle="Chưa có phiên đăng nhập"
      nextTask="S1-09 màn đăng nhập quản trị"
    />
  );
}
