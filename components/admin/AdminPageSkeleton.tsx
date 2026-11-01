import { SkeletonCard } from '@/components/common/SkeletonCard';
import skeleton from '@/components/common/Skeleton.module.css';
import styles from './AdminPage.module.css';

/** Khung chờ cùng bố cục với `AdminPage`, để trang không nhảy khi dữ liệu về. */
export function AdminPageSkeleton() {
  return (
    <div role="status" aria-label="Đang tải">
      <div className={styles.band}>
        <span className={`${skeleton.bar} ${skeleton.onBand} ${skeleton.heading}`} />
        <span className={`${skeleton.bar} ${skeleton.onBand} ${skeleton.subheading}`} />
      </div>
      <div className={styles.body}>
        <SkeletonCard />
      </div>
    </div>
  );
}
