import { ReactNode } from 'react';
import { Role } from '@/lib/types';
import Sidebar from '@/components/sidebar';

export default function DashboardShell({ role, title, children }: { role: Role; title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[16rem_1fr]">
        <Sidebar role={role} />
        <section className="space-y-4">
          <header className="rounded-xl border bg-white p-4">
            <h1 className="text-2xl font-bold text-brand-600">{title}</h1>
            <p className="text-sm text-slate-500">School ERP SaaS MVP</p>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
