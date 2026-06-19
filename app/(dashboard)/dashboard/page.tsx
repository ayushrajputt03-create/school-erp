<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
const cards=["Today's Sales","Monthly Sales","Total Products","Low Stock","Pending Udhaar"];
export default function DashboardPage(){return <div><h1 className="text-2xl font-bold mb-4">Dashboard</h1><div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">{cards.map(c=><div className="card" key={c}><p className="text-sm text-slate-500">{c}</p><p className="text-2xl font-semibold">--</p></div>)}</div></div>;}
=======
=======
>>>>>>> theirs
const modules = ['Students', 'Teachers', 'Classes & Sections', 'Attendance', 'Fees', 'Notices', 'Billing', 'Reports'];

export default function DashboardPage() {
  return <main className="min-h-screen p-6"><h1 className="mb-6 text-3xl font-bold text-brand-600">School ERP SaaS Dashboard</h1><div className="grid gap-4 md:grid-cols-4">{modules.map((module) => <section key={module} className="rounded-xl border bg-white p-4 shadow-sm"><h2 className="font-semibold">{module}</h2><p className="text-sm text-slate-500">Module ready for role-based workflows.</p></section>)}</div></main>;
}
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
=======
>>>>>>> theirs
import Link from 'next/link';

const panels = [
  { title: 'Super Admin', href: '/dashboard/super-admin', desc: 'Manage schools, pricing, billing and subscriptions.' },
  { title: 'Principal', href: '/dashboard/principal', desc: 'Manage students, teachers, classes, fees and reports.' },
  { title: 'Teacher', href: '/dashboard/teacher', desc: 'Mark attendance, manage homework and submit marks.' },
  { title: 'Student', href: '/dashboard/student', desc: 'Track attendance, homework, results and fee status.' },
  { title: 'Parent', href: '/dashboard/parent', desc: 'Monitor child profile, attendance, notices and fees.' }
];

export default function DashboardPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6">
      <h1 className="mb-2 text-3xl font-bold text-brand-600">School ERP SaaS MVP</h1>
      <p className="mb-6 text-slate-600">Choose a role panel to preview role-based experiences.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {panels.map((panel) => (
          <Link key={panel.href} href={panel.href} className="rounded-xl border bg-white p-5 shadow-sm hover:border-brand-500">
            <h2 className="font-semibold text-slate-900">{panel.title} Panel</h2>
            <p className="mt-1 text-sm text-slate-600">{panel.desc}</p>
          </Link>
=======
import { mockMetrics, modulesByRole } from '@/lib/mock-data';

export default function DashboardPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-blue-700">Role-Based ERP Dashboard</h1>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {mockMetrics.map((item) => (
          <div key={item.label} className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {Object.entries(modulesByRole).map(([role, modules]) => (
          <div key={role} className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="font-semibold">{role}</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              {modules.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
>>>>>>> theirs
        ))}
      </div>
    </main>
  );
}
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
