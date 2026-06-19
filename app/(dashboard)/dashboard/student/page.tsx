import DashboardShell from '@/components/dashboard-shell';
import StatsGrid from '@/components/stats-grid';

export default function StudentPage() {
  return <DashboardShell role="student" title="Student Dashboard"><StatsGrid stats={[{ label: 'Attendance', value: '93%' }, { label: 'Homework Due', value: '3' }, { label: 'Notices', value: '5' }, { label: 'Fee Status', value: 'Paid' }]} /></DashboardShell>;
}
