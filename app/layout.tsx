<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "VyaparFlow SaaS Billing",
    template: "%s | VyaparFlow"
  },
  description:
    "Multi-tenant POS, billing, inventory, GST invoices, and udhaar tracking for Indian local shops.",
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
import './globals.css';
import { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'School ERP SaaS',
  description: 'Multi-tenant school management platform'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
>>>>>>> theirs
      <body>{children}</body>
    </html>
  );
}
