import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";

export default async function AdminStokPage() {
  await requireRole(["admin", "owner", "branch_manager", "cashier", "waiter", "kitchen"]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Stok"
        description="Kelola persediaan bahan dan item menu."
      />
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Halaman Stok akan segera tersedia.
      </Card>
    </div>
  );
}
