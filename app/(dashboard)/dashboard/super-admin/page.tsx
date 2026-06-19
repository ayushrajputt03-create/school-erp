import DashboardShell from '@/components/dashboard-shell';
import StatsGrid from '@/components/stats-grid';

export default function SuperAdminPage() {
  return <DashboardShell role="super_admin" title="Super Admin Dashboard"><StatsGrid stats={[{ label: 'Total Schools', value: '24' }, { label: 'Active Students', value: '12,420' }, { label: 'Monthly Revenue', value: '₹47,196', trend: '+6.5%' }, { label: 'Suspended Schools', value: '1' }]} /></DashboardShell>;
}
