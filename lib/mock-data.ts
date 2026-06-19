export const mockMetrics = [
  { label: 'Schools', value: '42' },
  { label: 'Active Students', value: '18,240' },
  { label: 'Monthly Revenue', value: '₹72,960' },
  { label: 'Pending Invoices', value: '11' }
];

export const modulesByRole: Record<string, string[]> = {
  'Super Admin': ['Schools', 'Pricing Rules', 'Subscriptions', 'Invoices', 'Revenue'],
  Principal: ['Students', 'Teachers', 'Classes', 'Attendance', 'Fees', 'Notices'],
  Teacher: ['Assigned Classes', 'Attendance', 'Homework', 'Marks'],
  Student: ['Attendance', 'Homework', 'Results', 'Notices', 'Fee Status'],
  Parent: ['Child Profile', 'Attendance', 'Fees', 'Notices', 'Results']
};
