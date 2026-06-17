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
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Stok"
        description="Kelola ketersediaan stok item menu harian"
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
