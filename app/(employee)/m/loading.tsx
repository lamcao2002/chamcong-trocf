import type { CSSProperties } from 'react';
import { SkeletonCard } from '@/components/common/SkeletonCard';
import skeleton from '@/components/common/Skeleton.module.css';
import styles from '@/components/employee/EmployeeScreen.module.css';
import { themeCssVars } from '@/lib/theme/tokens';

export default function EmployeeLoading() {
  return (
    // Chưa biết công ty nên dùng màu mặc định của sản phẩm
    <div className={styles.page} style={themeCssVars() as CSSProperties} role="status" aria-label="Đang tải">
      <div className={styles.band}>
        <div className={styles.inner}>
          <span className={`${skeleton.bar} ${skeleton.onBand} ${skeleton.heading}`} />
        </div>
      </div>
      <div className={styles.body}>
        <SkeletonCard />
      </div>
    </div>
  );
}
