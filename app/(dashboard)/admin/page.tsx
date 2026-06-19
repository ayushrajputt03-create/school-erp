const shops = [
  { owner: "Amit General Store", plan: "Pro", status: "Active", revenue: 999 },
  { owner: "Sharma Stationery", plan: "Basic", status: "Expired", revenue: 499 },
  { owner: "City Medicos", plan: "Premium", status: "Active", revenue: 1999 }
];

export default function AdminPage() {
  const active = shops.filter((shop) => shop.status === "Active").length;
  const expired = shops.length - active;
  const revenue = shops.reduce((total, shop) => total + shop.revenue, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">SaaS Admin</h1>
        <p className="text-sm text-slate-500">
          Monitor shops, subscriptions, owners, plans, and platform revenue.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Total Shops", shops.length],
          ["Active Subscriptions", active],
          ["Expired Subscriptions", expired],
          ["Monthly Revenue", `Rs ${revenue.toLocaleString("en-IN")}`]
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-2">Shop Owner</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Revenue</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shops.map((shop) => (
              <tr key={shop.owner}>
                <td className="py-3 font-medium">{shop.owner}</td>
                <td>{shop.plan}</td>
                <td>
                  <span
                    className={
                      shop.status === "Active"
                        ? "rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                        : "rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
                    }
                  >
                    {shop.status}
                  </span>
                </td>
                <td>Rs {shop.revenue.toLocaleString("en-IN")}</td>
                <td>
                  <button className="text-brand-700">Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
