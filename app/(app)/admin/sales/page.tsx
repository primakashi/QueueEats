import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { SalesDashboard } from "./sales-dashboard";

export default async function AdminSalesPage() {
  await requireRole(["admin"]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Penjualan"
        description="Ringkasan penjualan. Saring per hari atau per jam, per cabang, lalu unduh Excel."
      />
      <SalesDashboard />
    </div>
  );
}
