<<<<<<< ours
<<<<<<< ours
import Link from "next/link";
const links = [["Dashboard","/dashboard"],["Products","/products"],["Billing","/billing"],["Customers","/customers"],["Reports","/reports"],["Subscription","/subscription"],["SaaS Admin","/admin"]];
export function Sidebar(){return <aside className="w-60 min-h-screen bg-slate-900 text-white p-5 hidden md:block"><h2 className="text-xl font-bold mb-6">VyaparFlow</h2><nav className="space-y-2">{links.map(([label,href])=><Link key={href} className="block rounded-lg px-3 py-2 hover:bg-slate-700" href={href}>{label}</Link>)}</nav></aside>;}
=======
=======
>>>>>>> theirs
import Link from 'next/link';
import { NavItem, Role } from '@/lib/types';

const navByRole: Record<Role, NavItem[]> = {
  super_admin: [
    { label: 'Schools', href: '/dashboard/super-admin/schools' },
    { label: 'Pricing', href: '/dashboard/super-admin/pricing' },
    { label: 'Billing', href: '/dashboard/super-admin/billing' },
    { label: 'Subscriptions', href: '/dashboard/super-admin/subscriptions' }
  ],
  principal: [
    { label: 'Students', href: '/dashboard/principal/students' },
    { label: 'Teachers', href: '/dashboard/principal/teachers' },
    { label: 'Classes', href: '/dashboard/principal/classes' },
    { label: 'Reports', href: '/dashboard/principal/reports' }
  ],
  teacher: [
    { label: 'Assigned Classes', href: '/dashboard/teacher/classes' },
    { label: 'Attendance', href: '/dashboard/teacher/attendance' },
    { label: 'Homework', href: '/dashboard/teacher/homework' },
    { label: 'Marks', href: '/dashboard/teacher/marks' }
  ],
  student: [
    { label: 'Attendance', href: '/dashboard/student/attendance' },
    { label: 'Homework', href: '/dashboard/student/homework' },
    { label: 'Results', href: '/dashboard/student/results' },
    { label: 'Fees', href: '/dashboard/student/fees' }
  ],
  parent: [
    { label: 'Child Profile', href: '/dashboard/parent/child' },
    { label: 'Attendance', href: '/dashboard/parent/attendance' },
    { label: 'Fees', href: '/dashboard/parent/fees' },
    { label: 'Notices', href: '/dashboard/parent/notices' }
  ]
};

export default function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="w-full rounded-xl border bg-white p-4 md:w-64">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{role.replace('_', ' ')} Panel</h2>
      <ul className="space-y-2">
        {navByRole[role].map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              <span>{item.label}</span>
              {item.badge ? <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-600">{item.badge}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
