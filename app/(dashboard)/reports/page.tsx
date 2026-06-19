const topProducts = [
  { name: "A4 Notebook", qty: 86, revenue: 4730, profit: 1462 },
  { name: "USB Type-C Cable", qty: 31, revenue: 6169, profit: 2294 },
  { name: "Paracetamol Strip", qty: 55, revenue: 1540, profit: 385 }
];

export default function ReportsPage() {
  const revenue = topProducts.reduce((total, item) => total + item.revenue, 0);
  const profit = topProducts.reduce((total, item) => total + item.profit, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Sales Reports</h1>
        <p className="text-sm text-slate-500">
          Daily sales, monthly sales, profit, and top-selling products.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Today's Sales", "Rs 42,800"],
          ["Monthly Sales", "Rs 8,64,200"],
          ["Gross Profit", `Rs ${profit.toLocaleString("en-IN")}`],
          ["GST Collected", "Rs 38,420"]
        ].map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="card">
          <h2 className="font-bold">Top Selling Products</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">Product</th>
                  <th>Qty Sold</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.map((product) => (
                  <tr key={product.name}>
                    <td className="py-3 font-medium">{product.name}</td>
                    <td>{product.qty}</td>
                    <td>Rs {product.revenue.toLocaleString("en-IN")}</td>
                    <td>Rs {product.profit.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="font-bold">Profit Snapshot</h2>
          <p className="mt-4 text-sm text-slate-500">Revenue</p>
          <p className="text-3xl font-bold">Rs {revenue.toLocaleString("en-IN")}</p>
          <p className="mt-4 text-sm text-slate-500">Estimated gross margin</p>
          <p className="text-3xl font-bold">{Math.round((profit / revenue) * 100)}%</p>
        </div>
      </div>
    </div>
  );
}
