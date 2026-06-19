"use client";

import { useMemo, useState } from "react";

type Product = {
  id: string;
  productName: string;
  category: string;
  barcode: string;
  purchasePrice: number;
  sellingPrice: number;
  gstPercent: number;
  stockQuantity: number;
  lowStockLimit: number;
};

const seedProducts: Product[] = [
  {
    id: "p-1",
    productName: "A4 Notebook",
    category: "Stationery",
    barcode: "89010001",
    purchasePrice: 38,
    sellingPrice: 55,
    gstPercent: 12,
    stockQuantity: 42,
    lowStockLimit: 10
  },
  {
    id: "p-2",
    productName: "USB Type-C Cable",
    category: "Mobile Accessories",
    barcode: "89010002",
    purchasePrice: 125,
    sellingPrice: 199,
    gstPercent: 18,
    stockQuantity: 8,
    lowStockLimit: 10
  }
];

const emptyProduct = {
  productName: "",
  category: "",
  barcode: "",
  purchasePrice: 0,
  sellingPrice: 0,
  gstPercent: 0,
  stockQuantity: 0,
  lowStockLimit: 5
};

export default function ProductsPage() {
  const [products, setProducts] = useState(seedProducts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((product) => product.category)))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const search = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        product.productName.toLowerCase().includes(search) ||
        product.barcode.includes(search);
      const matchesCategory = category === "All" || product.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [category, products, query]);

  function submitProduct(event: React.FormEvent) {
    event.preventDefault();

    if (editingId) {
      setProducts((current) =>
        current.map((product) =>
          product.id === editingId ? { ...product, ...form } : product
        )
      );
    } else {
      setProducts((current) => [
        {
          id: `p-${Date.now()}`,
          ...form
        },
        ...current
      ]);
    }

    setEditingId(null);
    setForm(emptyProduct);
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setForm({
      productName: product.productName,
      category: product.category,
      barcode: product.barcode,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      gstPercent: product.gstPercent,
      stockQuantity: product.stockQuantity,
      lowStockLimit: product.lowStockLimit
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Product Management</h1>
        <p className="text-sm text-slate-500">
          Add products, manage pricing, and catch low-stock items early.
        </p>
      </div>

      <form className="card grid gap-3 lg:grid-cols-4" onSubmit={submitProduct}>
        <input
          required
          className="field"
          placeholder="Product name"
          value={form.productName}
          onChange={(event) => setForm({ ...form, productName: event.target.value })}
        />
        <input
          required
          className="field"
          placeholder="Category"
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
        />
        <input
          className="field"
          placeholder="Barcode"
          value={form.barcode}
          onChange={(event) => setForm({ ...form, barcode: event.target.value })}
        />
        <button className="btn-primary" type="submit">
          {editingId ? "Update Product" : "Add Product"}
        </button>
        {[
          ["Purchase price", "purchasePrice"],
          ["Selling price", "sellingPrice"],
          ["GST %", "gstPercent"],
          ["Stock quantity", "stockQuantity"],
          ["Low stock limit", "lowStockLimit"]
        ].map(([label, key]) => (
          <label key={key} className="text-sm font-medium text-slate-700">
            {label}
            <input
              className="field mt-1"
              type="number"
              value={form[key as keyof typeof form]}
              onChange={(event) =>
                setForm({ ...form, [key]: Number(event.target.value) })
              }
            />
          </label>
        ))}
      </form>

      <div className="flex flex-wrap gap-3">
        <input
          className="field max-w-sm"
          placeholder="Search product or barcode"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="field max-w-xs"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-2">Name</th>
              <th>Category</th>
              <th>Barcode</th>
              <th>Purchase</th>
              <th>Selling</th>
              <th>GST</th>
              <th>Stock</th>
              <th>Alert</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td className="py-3 font-medium">{product.productName}</td>
                <td>{product.category}</td>
                <td>{product.barcode}</td>
                <td>Rs {product.purchasePrice}</td>
                <td>Rs {product.sellingPrice}</td>
                <td>{product.gstPercent}%</td>
                <td>{product.stockQuantity}</td>
                <td>
                  <span
                    className={
                      product.stockQuantity <= product.lowStockLimit
                        ? "rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
                        : "rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                    }
                  >
                    {product.stockQuantity <= product.lowStockLimit ? "Low stock" : "OK"}
                  </span>
                </td>
                <td className="space-x-2">
                  <button className="text-brand-700" onClick={() => editProduct(product)}>
                    Edit
                  </button>
                  <button
                    className="text-red-700"
                    onClick={() =>
                      setProducts((current) =>
                        current.filter((item) => item.id !== product.id)
                      )
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
