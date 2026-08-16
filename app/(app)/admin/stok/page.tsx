import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getStockSnapshot } from "./actions";
import { StokManager } from "./stok-manager";

type Props = {
  searchParams: Promise<{ outlet?: string }>;
};

export default async function AdminStokPage({ searchParams }: Props) {
  await requireRole(["admin", "owner", "branch_manager", "cashier", "waiter", "kitchen"]);
  const { outlet } = await searchParams;
  const res = await getStockSnapshot(outlet);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader
        title="Stok Menu"
        description="Catat stok awal dan pantau ketersediaan menu sepanjang hari"
      />
      {res.ok ? (
        <StokManager snapshot={res.data} />
      ) : (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {res.error}
        </Card>
      )}
    </div>
  );
}
