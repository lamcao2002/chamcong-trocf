import type { Metadata } from 'next';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export const metadata: Metadata = { title: 'Hộp việc' };

export default function AdminHomePage() {
  return (
    <PlaceholderScreen
      title="Trang quản trị"
      subtitle="Hộp việc, Bảng công, Xếp ca, Lương"
      nextTask="S1-05 khung giao diện quản trị, S1-09 màn đăng nhập"
    />
  );
}
