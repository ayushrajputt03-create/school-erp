import { DashboardStat } from '@/lib/types';

export default function StatsGrid({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <article key={stat.label} className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stat.value}</p>
          {stat.trend ? <p className="mt-2 text-xs text-emerald-600">{stat.trend}</p> : null}
        </article>
      ))}
    </div>
  );
}
