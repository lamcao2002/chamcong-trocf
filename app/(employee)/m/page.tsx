import type { CSSProperties } from 'react';
import { CheckOutlined } from '@ant-design/icons';
import { LoginForm } from '@/components/common/LoginForm';
import { EmployeeHome } from '@/components/employee/EmployeeHome';
import styles from '@/components/employee/EmployeeScreen.module.css';
import { getSession } from '@/lib/auth/session';
import { getAppHome } from '@/lib/services/attendance';
import { themeCssVars } from '@/lib/theme/tokens';

type EmployeePageProps = {
  searchParams: Promise<{ ma?: string | string[] }>;
};

/** Mã trên link mời; chỉ điền sẵn vào form, không tra CSDL để không lộ mã nào tồn tại. */
function companyCodeFrom(ma: string | string[] | undefined): string | undefined {
  const code = (Array.isArray(ma) ? ma[0] : ma)?.trim().toUpperCase();
  return code || undefined;
}

/** `/m`: chưa có phiên là M1 đăng nhập, có phiên là màn chính. */
export default async function EmployeePage({ searchParams }: EmployeePageProps) {
  const session = await getSession('app');

  if (session) {
    return (
      <div
        className={styles.page}
        style={themeCssVars(session.company.brandColor ?? undefined) as CSSProperties}
      >
        <EmployeeHome
          name={session.employee.name}
          role={session.employee.role}
          companyName={session.company.name}
          brandColor={session.company.brandColor}
          home={await getAppHome(session)}
        />
      </div>
    );
  }

  return (
    // Chưa biết công ty nên dùng màu mặc định của sản phẩm
    <div className={styles.page} style={themeCssVars() as CSSProperties}>
      <header className={styles.band}>
        <div className={styles.inner}>
          <div className={styles.brand}>
            <span className={styles.logo} aria-hidden>
              <CheckOutlined />
            </span>
            Chấm công
          </div>
        </div>
      </header>
      <main className={styles.body}>
        <div className={styles.card}>
          <h1 className={styles.title}>Đăng nhập</h1>
          <p className={styles.muted}>Dùng email và mã PIN quản lý đã cấp cho bạn.</p>
          <LoginForm
            kind="app"
            redirectTo="/m"
            defaultCompanyCode={companyCodeFrom((await searchParams).ma)}
          />
        </div>
      </main>
    </div>
  );
}
