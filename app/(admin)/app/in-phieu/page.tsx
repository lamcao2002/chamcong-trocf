import type { Metadata } from 'next';
import { z } from 'zod';
import { AutoPrint } from '@/components/admin/print/AutoPrint';
import styles from '@/components/admin/print/print.module.css';
import { requireAdminPage } from '@/lib/auth/guard';
import { STATE_LABELS } from '@/lib/export/labels';
import { formatDate, formatDecimal, formatMoney } from '@/lib/format';
import { getPayrollDocument } from '@/lib/services/payroll';
import { themeCssVars } from '@/lib/theme/tokens';
import { periodKeySchema } from '@/lib/validation/request';

export const metadata: Metadata = { title: 'In phiếu lương' };

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
      {document.slips.map(({ employeeId, name, positionName, cong, otApprovedMin, lines, net }) => (
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
              <dd>{otApprovedMin} phút</dd>
            </div>
          </dl>
          <table className={styles.lines}>
            <thead>
              <tr>
                <th scope="col">Khoản</th>
                <th scope="col" className={styles.amount}>
                  Số tiền
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td>
                    {line.name}
                    <span className={styles.how}>{line.how}</span>
                  </td>
                  <td className={styles.amount}>{formatMoney(line.amount)}</td>
                </tr>
              ))}
              <tr className={styles.net}>
                <td>Thực lĩnh</td>
                <td className={styles.amount}>{formatMoney(net)}</td>
              </tr>
            </tbody>
          </table>
        </article>
      ))}
    </main>
  );
}
