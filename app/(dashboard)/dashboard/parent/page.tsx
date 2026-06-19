import DashboardShell from '@/components/dashboard-shell';
import StatsGrid from '@/components/stats-grid';

export default function ParentPage() {
  return <DashboardShell role="parent" title="Parent Dashboard"><StatsGrid stats={[{ label: 'Child Attendance', value: '95%' }, { label: 'Fee Due', value: '₹0' }, { label: 'Notices', value: '2' }, { label: 'Latest Result', value: 'A Grade' }]} /></DashboardShell>;
}
