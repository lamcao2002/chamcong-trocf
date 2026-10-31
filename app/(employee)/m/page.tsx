import type { Metadata } from 'next';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export const metadata: Metadata = { title: 'App nhân viên' };

export default function EmployeeHomePage() {
  return (
    <PlaceholderScreen
      title="Chấm công"
      subtitle="App dành cho nhân viên"
      nextTask="S1-10 màn đăng nhập nhân viên và PWA manifest"
    />
  );
}
