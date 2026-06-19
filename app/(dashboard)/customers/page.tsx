const customers = [
  {
    name: "Ramesh Kumar",
    phone: "9876543210",
    purchases: 18,
    credit: 2450,
    lastPurchase: "28 May 2026"
  },
  {
    name: "Pooja Stationers",
    phone: "9811122233",
    purchases: 7,
    credit: 0,
    lastPurchase: "27 May 2026"
  },
  {
    name: "Walk-in Customer",
    phone: "-",
    purchases: 42,
    credit: 0,
    lastPurchase: "28 May 2026"
  }
];

export default function CustomersPage() {
  const pendingCredit = customers.reduce((total, customer) => total + customer.credit, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Customer Management</h1>
        <p className="text-sm text-slate-500">
          Track phone numbers, purchase history, and pending udhaar.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Customers</p>
          <p className="mt-2 text-2xl font-bold">{customers.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Pending Udhaar</p>
          <p className="mt-2 text-2xl font-bold">Rs {pendingCredit.toLocaleString("en-IN")}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Repeat Buyers</p>
          <p className="mt-2 text-2xl font-bold">2</p>
        </div>
      </div>

      <form className="card grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input className="field" placeholder="Customer name" />
        <input className="field" placeholder="Phone number" />
        <button className="btn-primary">Add Customer</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-2">Customer</th>
              <th>Phone</th>
              <th>Purchases</th>
              <th>Last Purchase</th>
              <th>Pending Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((customer) => (
              <tr key={customer.name}>
                <td className="py-3 font-medium">{customer.name}</td>
                <td>{customer.phone}</td>
                <td>{customer.purchases}</td>
                <td>{customer.lastPurchase}</td>
                <td>
                  <span
                    className={
                      customer.credit > 0
                        ? "rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
                        : "rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                    }
                  >
                    Rs {customer.credit.toLocaleString("en-IN")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
