<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import Link from "next/link";

const features = [
  "Fast POS with barcode-ready search",
  "GST invoices, print, and PDF download",
  "Customer credit and udhaar tracking",
  "Shop-wise data isolation with Supabase RLS",
  "Role-based owner and staff access",
  "Reports for sales, profit, and top products"
];

const plans = [
  {
    name: "Free Trial",
    price: "Rs 0",
    detail: "14 days, 100 invoices, 1 staff user"
  },
  {
    name: "Basic",
    price: "Rs 499/mo",
    detail: "1,000 invoices/month, 2 staff users"
  },
  {
    name: "Pro",
    price: "Rs 999/mo",
    detail: "Unlimited invoices, udhaar, WhatsApp invoices"
  },
  {
    name: "Premium",
    price: "Rs 1,999/mo",
    detail: "Multi-branch, GST reports, barcode scanner"
  }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-700">
            VyaparFlow
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Login
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            Billing SaaS for Indian local shops
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            POS, GST billing, inventory, and udhaar in one clean shop system.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Built for grocery, stationery, pharmacy, mobile accessory, and
            general stores that need fast billing and simple business control.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-md bg-brand-600 px-5 py-3 font-semibold text-white"
            >
              Start Demo
            </Link>
            <a
              href="#pricing"
              className="rounded-md border border-slate-300 px-5 py-3 font-semibold text-slate-800"
            >
              View Pricing
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3">
            {["Today's sales", "Monthly sales", "Low stock", "Pending udhaar"].map(
              (label, index) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-md border border-slate-200 p-4"
                >
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className="text-xl font-bold">
                    {index === 2 ? "8" : index === 3 ? "Rs 12,450" : "Rs 42,800"}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-bold">Everything a small shop expects</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature} className="card">
              <p className="font-medium">{feature}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">Simple Plans</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.name} className="card">
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="mt-3 text-2xl font-bold">{plan.price}</p>
              <p className="mt-3 text-sm text-slate-600">{plan.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <p className="font-semibold">"Billing is faster and staff training is easy."</p>
            <p className="mt-2 text-sm text-slate-500">Kirana store owner, Delhi NCR</p>
          </div>
          <form className="card space-y-3">
            <h2 className="text-xl font-bold">Contact Sales</h2>
            <input className="w-full rounded-md border p-2" placeholder="Name" />
            <input className="w-full rounded-md border p-2" placeholder="Phone" />
            <textarea className="w-full rounded-md border p-2" placeholder="Message" />
            <button className="rounded-md bg-brand-600 px-4 py-2 font-semibold text-white">
              Request Callback
            </button>
          </form>
        </div>
      </section>
    </main>
  );
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-blue-700">School ERP SaaS MVP</h1>
        <p className="mt-3 text-slate-600">Production-ready multi-tenant ERP with role dashboards and billing.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/login" className="rounded bg-blue-600 px-4 py-2 text-white">Login</Link>
          <Link href="/dashboard" className="rounded border px-4 py-2">View Dashboard</Link>
        </div>
      </div>
    </main>
  );
>>>>>>> theirs
}
