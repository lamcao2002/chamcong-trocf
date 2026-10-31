import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckOutlined } from '@ant-design/icons';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import styles from '@/components/admin/AdminLogin.module.css';
import { getSession } from '@/lib/auth/session';
import { themeCssVars } from '@/lib/theme/tokens';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default async function AdminLoginPage() {
  if (await getSession('admin')) redirect('/app');

  return (
    // Chưa biết công ty nên dùng màu mặc định của sản phẩm
    <div className={styles.page} style={themeCssVars() as CSSProperties}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden>
            <CheckOutlined />
          </span>
          Chấm công
        </div>
        <p className={styles.slogan}>Chấm công, xếp ca, tính lương gọn trong một nơi</p>
        <span aria-hidden />
      </section>
      <main className={styles.formSide}>
        <div className={styles.card}>
          <h1 className={styles.title}>Đăng nhập quản trị</h1>
          <p className={styles.subtitle}>Dùng email và mã PIN được cấp.</p>
          <AdminLoginForm />
        </div>
      </main>
    </div>
  );
}
