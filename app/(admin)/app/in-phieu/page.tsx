import type { Metadata } from 'next';
import { z } from 'zod';
import { DayTable } from '@/components/admin/payroll/DayTable';
import { hoursMinutes } from '@/components/admin/payroll/payroll-text';
import { AutoPrint } from '@/components/admin/print/AutoPrint';
import styles from '@/components/admin/print/print.module.css';
import { requireAdminPage } from '@/lib/auth/guard';
import { STATE_LABELS } from '@/lib/export/labels';
import { formatDate, formatDecimal, formatMoney } from '@/lib/format';
import type { PayLine } from '@/lib/payroll/compute-pay';
import { getPayrollDocument } from '@/lib/services/payroll';
import { themeCssVars } from '@/lib/theme/tokens';
import { periodKeySchema } from '@/lib/validation/request';

export const metadata: Metadata = { title: 'In phiếu lương' };

/**
 * Phiếu in không có "Vì sao ra số này": bảng ngày công đã có tiền từng ca, chỉ giữ thưởng/phạt nhập
 * tay. Phiếu công bố trước khi có bảng ngày công thì in đủ dòng như cũ.
 */
const shownLines = (lines: readonly PayLine[], hasDays: boolean) =>
  hasDays ? lines.filter(({ key }) => key.startsWith('adjustment_')) : lines;

type PrintPageProps = {
  searchParams: Promise<{ period?: string; nv?: string }>;
};

/** Trang in nằm ngoài khung quản trị để giấy chỉ có phiếu; bỏ `nv` là in cả kỳ, mỗi người một tờ (PAY-08). */
export default async function PrintPayslipsPage({ searchParams }: PrintPageProps) {
  const ctx = await requireAdminPage('payroll');
  const { period, nv } = await searchParams;
  const key = periodKeySchema.safeParse(period);
  const employee = z.string().uuid().safeParse(nv);
  const document = await getPayrollDocument(
    ctx,
    key.success ? key.data : undefined,
    employee.success ? employee.data : undefined,
  );
  const range = `${formatDate(document.period.from)} – ${formatDate(document.period.to)}`;

  return (
    <main className={styles.page} style={themeCssVars(ctx.company.brandColor ?? undefined)}>
      {document.slips.length > 0 ? <AutoPrint /> : <p className={styles.empty}>Không có phiếu nào để in.</p>}
      {document.slips.map(
        ({ employeeId, name, positionName, cong, otApprovedMin, lines, net, days, multiPosition }) => (
          <article key={employeeId} className={styles.slip}>
            <p className={styles.company}>{ctx.company.name}</p>
            <h1 className={styles.title}>Phiếu lương {range}</h1>
            <p className={document.state === 'published' ? styles.state : styles.draft}>
              {STATE_LABELS[document.state]}
            </p>
            <dl className={styles.facts}>
              <div>
                <dt>Nhân viên</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>Vị trí</dt>
                <dd>{positionName ?? 'Chưa có vị trí'}</dd>
              </div>
              <div>
                <dt>Công</dt>
                <dd>{formatDecimal(cong)}</dd>
              </div>
              <div>
                <dt>OT đã duyệt</dt>
                <dd>{otApprovedMin === 0 ? '0' : hoursMinutes(otApprovedMin)}</dd>
              </div>
            </dl>
            <p className={styles.netBox}>
              <span>Thực lĩnh</span>
              <strong>{formatMoney(net)}</strong>
            </p>
            {shownLines(lines, days.length > 0).length > 0 ? (
              <table className={styles.lines}>
                <thead>
                  <tr>
                    <th scope="col">{days.length > 0 ? 'Thưởng / phạt' : 'Khoản'}</th>
                    <th scope="col" className={styles.amount}>
                      Số tiền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shownLines(lines, days.length > 0).map((line) => (
                    <tr key={line.key}>
                      <td>
                        {line.name}
                        <span className={styles.how}>{line.how}</span>
                      </td>
                      <td className={styles.amount}>{formatMoney(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {days.length > 0 ? (
              <section className={styles.days} aria-label="Chi tiết ngày công">
                <h2 className={styles.daysTitle}>
                  Chi tiết {new Set(days.map(({ date }) => date)).size} ngày công
                </h2>
                <DayTable days={days} variant="slip" showPosition={multiPosition} />
              </section>
            ) : null}
          </article>
        ),
      )}
    </main>
  );
}
