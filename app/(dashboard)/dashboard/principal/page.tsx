import DashboardShell from '@/components/dashboard-shell';
import StatsGrid from '@/components/stats-grid';

export default function PrincipalPage() {
  return <DashboardShell role="principal" title="Principal Dashboard"><StatsGrid stats={[{ label: 'Students', value: '1,040' }, { label: 'Teachers', value: '56' }, { label: 'Classes', value: '28' }, { label: 'Pending Fees', value: '₹1,35,000' }]} /></DashboardShell>;
}
