import { Sidebar } from "@/components/sidebar";
export default function DashboardLayout({ children }: { children: React.ReactNode }) { return <div className="flex"><Sidebar /><main className="flex-1 p-4 md:p-6">{children}</main></div>; }
