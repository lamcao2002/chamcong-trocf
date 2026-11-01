import styles from './Skeleton.module.css';

/** Thẻ giữ chỗ khi trang đang tải; chỉ dùng CSS để hiện được trước khi có dữ liệu. */
export function SkeletonCard() {
  return (
    <div className={styles.card}>
      <span className={styles.bar} />
      <span className={styles.bar} />
      <span className={`${styles.bar} ${styles.short}`} />
    </div>
  );
}
