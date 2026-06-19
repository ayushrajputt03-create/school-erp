import { getPlanLimits } from "@/lib/subscription";
import type { PlanName } from "@/lib/types";

const plans: Array<{
  code: PlanName;
  name: string;
  monthly: string;
  yearly: string;
  features: string[];
}> = [
  {
    code: "FREE_TRIAL",
    name: "Free Trial",
    monthly: "Rs 0",
    yearly: "14 days",
    features: ["100 invoices", "1 staff user", "Basic reports"]
  },
  {
    code: "BASIC",
    name: "Basic",
    monthly: "Rs 499/month",
    yearly: "Rs 4,999/year",
    features: ["1,000 invoices/month", "2 staff users", "Product and billing"]
  },
  {
    code: "PRO",
    name: "Pro",
    monthly: "Rs 999/month",
    yearly: "Rs 9,999/year",
    features: ["Unlimited invoices", "5 staff users", "Udhaar and WhatsApp invoice"]
  },
  {
    code: "PREMIUM",
    name: "Premium",
    monthly: "Rs 1,999/month",
    yearly: "Rs 19,999/year",
    features: ["Multi-branch", "15 staff users", "GST reports and priority support"]
  }
];

export default function SubscriptionPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="text-sm text-slate-500">
          Upgrade, renew, and enforce billing limits by shop.
        </p>
      </div>

      <div className="card border-amber-200 bg-amber-50 text-amber-900">
        Current demo state: expired shops can login and read old data, but the
        invoice creation action should be blocked until renewal.
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {plans.map((plan) => {
          const limits = getPlanLimits(plan.code);

          return (
            <div key={plan.code} className="card flex flex-col">
              <h2 className="text-lg font-bold">{plan.name}</h2>
              <p className="mt-3 text-2xl font-bold">{plan.monthly}</p>
              <p className="text-sm text-slate-500">{plan.yearly}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                Limit model: {limits.invoices.toLocaleString("en-IN")} invoices,{" "}
                {limits.staff} staff users
              </div>
              <button className="btn-primary mt-4">Select Plan</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
