"use client";

import jsPDF from "jspdf";
import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  barcode: string;
  stock: number;
  sellingPrice: number;
  gstPercent: number;
};

type CartItem = Product & {
  quantity: number;
  discount: number;
};

const products: Product[] = [
  {
    id: "p-1",
    name: "A4 Notebook",
    barcode: "89010001",
    stock: 42,
    sellingPrice: 55,
    gstPercent: 12
  },
  {
    id: "p-2",
    name: "USB Type-C Cable",
    barcode: "89010002",
    stock: 18,
    sellingPrice: 199,
    gstPercent: 18
  },
  {
    id: "p-3",
    name: "Paracetamol Strip",
    barcode: "89010003",
    stock: 25,
    sellingPrice: 28,
    gstPercent: 5
  }
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);

export default function BillingPage() {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [customerName, setCustomerName] = useState("");
  const [status, setStatus] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("INV-0000-00000");

  const filteredProducts = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return products;
    }

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(search) ||
        product.barcode.includes(search)
    );
  }, [query]);

  const totals = useMemo(
    () =>
      cart.reduce(
        (summary, item) => {
          const subtotal = item.sellingPrice * item.quantity;
          const discount = Math.min(subtotal, item.discount);
          const taxable = subtotal - discount;
          const gst = taxable * (item.gstPercent / 100);

          return {
            subtotal: summary.subtotal + subtotal,
            discount: summary.discount + discount,
            gst: summary.gst + gst,
            grandTotal: summary.grandTotal + taxable + gst
          };
        },
        { subtotal: 0, discount: 0, gst: 0, grandTotal: 0 }
      ),
    [cart]
  );

  useEffect(() => {
    setInvoiceNumber(`INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`);
  }, []);

  function addToCart(product: Product) {
    setStatus("");
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.stock, item.quantity + 1) }
            : item
        );
      }

      return [...current, { ...product, quantity: 1, discount: 0 }];
    });
  }

  function updateItem(id: string, patch: Partial<CartItem>) {
    setCart((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              quantity: Math.max(1, Math.min(item.stock, patch.quantity ?? item.quantity)),
              discount: Math.max(0, patch.discount ?? item.discount)
            }
          : item
      )
    );
  }

  function saveInvoice() {
    if (cart.length === 0) {
      setStatus("Add at least one product before saving the invoice.");
      return;
    }

    if (paymentMode === "Credit/Udhaar" && customerName.trim().length < 2) {
      setStatus("Customer name is required for credit/udhaar invoices.");
      return;
    }

    setStatus(`${invoiceNumber} saved locally for demo. Connect Supabase to persist it.`);
  }

  function printInvoice() {
    window.print();
  }

  function downloadPdf() {
    const doc = new jsPDF();
    doc.text("VyaparFlow Invoice", 12, 14);
    doc.text(`Invoice: ${invoiceNumber}`, 12, 24);
    doc.text(`Customer: ${customerName || "Walk-in customer"}`, 12, 34);
    doc.text(`Payment: ${paymentMode}`, 12, 44);
    doc.text(`Total: ${formatMoney(totals.grandTotal)}`, 12, 54);
    doc.save(`${invoiceNumber}.pdf`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">POS Billing</h1>
          <p className="text-sm text-slate-500">Invoice {invoiceNumber}</p>
        </div>
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Expired subscriptions can view old bills but cannot create new invoices.
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="card space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Product search</label>
            <input
              className="field mt-1"
              placeholder="Search by name or barcode"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="divide-y divide-slate-100">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                className="flex w-full items-center justify-between gap-3 py-3 text-left"
                onClick={() => addToCart(product)}
              >
                <span>
                  <span className="block font-medium">{product.name}</span>
                  <span className="text-xs text-slate-500">
                    {product.barcode} | Stock {product.stock} | GST {product.gstPercent}%
                  </span>
                </span>
                <span className="font-semibold">{formatMoney(product.sellingPrice)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="field"
              placeholder="Customer name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
            <select
              className="field"
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value)}
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Card</option>
              <option>Credit/Udhaar</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">Item</th>
                  <th>Qty</th>
                  <th>Discount</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map((item) => {
                  const taxable = item.sellingPrice * item.quantity - item.discount;
                  const total = taxable + taxable * (item.gstPercent / 100);

                  return (
                    <tr key={item.id}>
                      <td className="py-3 font-medium">{item.name}</td>
                      <td>
                        <input
                          className="field w-20"
                          type="number"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.id, { quantity: Number(event.target.value) })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="field w-24"
                          type="number"
                          value={item.discount}
                          onChange={(event) =>
                            updateItem(item.id, { discount: Number(event.target.value) })
                          }
                        />
                      </td>
                      <td className="text-right font-semibold">{formatMoney(total)}</td>
                    </tr>
                  );
                })}
                {cart.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-slate-500" colSpan={4}>
                      Add products from the search panel to begin billing.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-sm space-y-2 rounded-md bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>{formatMoney(totals.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST</span>
              <span>{formatMoney(totals.gst)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold">
              <span>Total</span>
              <span>{formatMoney(totals.grandTotal)}</span>
            </div>
          </div>

          {status && <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">{status}</p>}

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={saveInvoice}>
              Save Invoice
            </button>
            <button className="btn-secondary" onClick={printInvoice}>
              Print
            </button>
            <button className="btn-secondary" onClick={downloadPdf}>
              Download PDF
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
