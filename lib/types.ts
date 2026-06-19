<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
export type Role = "owner" | "staff" | "saas_admin";
export type PlanName = "FREE_TRIAL" | "BASIC" | "PRO" | "PREMIUM";
export type PaymentMode = "CASH" | "UPI" | "CARD" | "CREDIT";
=======
export type Role = 'super_admin' | 'principal' | 'teacher' | 'student' | 'parent';
>>>>>>> theirs
=======
export type Role = 'super_admin' | 'principal' | 'teacher' | 'student' | 'parent';
>>>>>>> theirs
=======
=======
>>>>>>> theirs
export type Role = 'super_admin' | 'principal' | 'teacher' | 'student' | 'parent';

export interface UserProfile {
  id: string;
  school_id: string;
  role: Role;
  full_name: string;
  email?: string;
  phone?: string;
}

export interface DashboardStat {
  label: string;
  value: string;
  trend?: string;
}

export interface NavItem {
  label: string;
  href: string;
  badge?: string;
}
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
