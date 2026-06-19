import { PlanName } from "./types";
const limits: Record<PlanName, { invoices: number; staff: number }> = {
  FREE_TRIAL: { invoices: 100, staff: 1 }, BASIC: { invoices: 1000, staff: 2 }, PRO: { invoices: Number.MAX_SAFE_INTEGER, staff: 5 }, PREMIUM: { invoices: Number.MAX_SAFE_INTEGER, staff: 15 }
};
export const getPlanLimits = (plan: PlanName) => limits[plan];
export const isSubscriptionActive = (endDate: string) => new Date(endDate) >= new Date();
