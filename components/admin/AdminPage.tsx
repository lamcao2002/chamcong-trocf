import type { ReactNode } from 'react';
import styles from './AdminPage.module.css';

type AdminPageProps = {
  title: string;
  subtitle?: ReactNode;
  /** Nút hoặc điều hướng nằm trên dải header. */
  extra?: ReactNode;
  /** Hàng điều khiển thứ hai trên dải header, vd chọn kỳ và nút xuất. */
  toolbar?: ReactNode;
  children: ReactNode;
};

/** Khung một trang quản trị: dải header gradient, thẻ đầu tiên chồng lên mép dưới dải. */
export function AdminPage({ title, subtitle, extra, toolbar, children }: AdminPageProps) {
  return (
    <>
      <header className={styles.band}>
        <div className={styles.head}>
          <div>
            <h1 className={styles.title}>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {extra}
        </div>
        {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </>
  );
}
