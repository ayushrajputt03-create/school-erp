import DashboardShell from '@/components/dashboard-shell';
import StatsGrid from '@/components/stats-grid';

export default function TeacherPage() {
  return <DashboardShell role="teacher" title="Teacher Dashboard"><StatsGrid stats={[{ label: 'Assigned Classes', value: '4' }, { label: 'Today Attendance', value: '96%' }, { label: 'Homework Pending', value: '7' }, { label: 'Marks Entries', value: '42' }]} /></DashboardShell>;
}
