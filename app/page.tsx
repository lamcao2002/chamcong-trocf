import { redirect } from 'next/navigation';

/** Trang gốc chuyển thẳng tới trang quản trị. */
export default function RootPage() {
  redirect('/app');
}
