import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminPage } from '@/lib/auth/guard';

export default async function AdminShellLayout({ children }: { children: ReactNode }) {
  const { employee, company } = await requireAdminPage();

  return (
    <AdminShell
      viewer={{
        name: employee.name,
        role: employee.role,
        companyName: company.name,
        brandColor: company.brandColor,
      }}
    >
      {children}
    </AdminShell>
  );
}
