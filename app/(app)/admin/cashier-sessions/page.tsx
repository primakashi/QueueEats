import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getOutletFilter } from "@/lib/auth";
import { formatIDR, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CashierSession, CashMovement } from "@/lib/types";

type SessionWithExtras = CashierSession & {
  outlet_name: string | null;
  opener_name: string | null;
  closer_name: string | null;
  cash_in: number;
  cash_out: number;
  cash_sales: number;
};

export default async function CashierSessionsPage() {
  const profile = await requireRole(["admin", "owner", "finance", "branch_manager"]);
  const supabase = await createClient();
  const outletFilter = getOutletFilter(profile);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  let sessionsQuery = supabase
    .from("cashier_sessions")
    .select(`
      *,
      outlets ( name ),
      opener:profiles!cashier_sessions_opened_by_fkey ( full_name ),
      closer:profiles!cashier_sessions_closed_by_fkey ( full_name )
    `)
    .gte("session_date", cutoff.toISOString().slice(0, 10))
    .order("session_date", { ascending: false });
  if (outletFilter) sessionsQuery = sessionsQuery.eq("outlet_id", outletFilter);

  const { data: sessionsRaw } = await sessionsQuery;
  const sessions = (sessionsRaw ?? []) as Array<Record<string, unknown>>;

  if (sessions.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <PageHeader title="Sesi Kasir" description="Riwayat sesi kasir 30 hari terakhir" />
        <div className="p-12 text-center text-sm text-muted-foreground border rounded-md">
          Belum ada sesi kasir.
        </div>
      </div>
    );
  }

  // Fetch all movements for these sessions in one query
  const sessionIds = sessions.map((s) => s.id as string);
  const { data: movementsRaw } = await supabase
    .from("cash_movements")
    .select("session_id, type, amount")
    .in("session_id", sessionIds);
  const movements = (movementsRaw ?? []) as Pick<CashMovement, "session_id" | "type" | "amount">[];

  // Fetch cash sales per session date+outlet
  const dateOutletPairs = sessions.map((s) => ({
    date: s.session_date as string,
    outlet_id: s.outlet_id as string | null,
  }));
  const minDate = dateOutletPairs.at(-1)?.date ?? cutoff.toISOString().slice(0, 10);
  let cashSalesQuery = supabase
    .from("orders")
    .select("outlet_id, total, updated_at")
    .eq("payment_method", "cash")
    .eq("payment_status", "paid")
    .gte("updated_at", `${minDate}T00:00:00.000Z`);
  if (outletFilter) cashSalesQuery = cashSalesQuery.eq("outlet_id", outletFilter);
  const { data: cashOrdersRaw } = await cashSalesQuery;
  const cashOrders = (cashOrdersRaw ?? []) as Array<{ outlet_id: string | null; total: number; updated_at: string }>;

  // Build session rows with computed totals
  const rows: SessionWithExtras[] = sessions.map((s) => {
    const sid = s.id as string;
    const outletId = s.outlet_id as string | null;
    const sessionDate = s.session_date as string;

    const sessionMovements = movements.filter((m) => m.session_id === sid);
    const cashIn = sessionMovements.filter((m) => m.type === "cash_in").reduce((sum, m) => sum + m.amount, 0);
    const cashOut = sessionMovements.filter((m) => m.type === "cash_out").reduce((sum, m) => sum + m.amount, 0);
    const cashSales = cashOrders
      .filter((o) => {
        const orderDate = o.updated_at.slice(0, 10);
        return orderDate === sessionDate && (!outletId || o.outlet_id === outletId);
      })
      .reduce((sum, o) => sum + o.total, 0);

    return {
      ...(s as unknown as CashierSession),
      outlet_name: (s.outlets as { name?: string } | null)?.name ?? null,
      opener_name: (s.opener as { full_name?: string } | null)?.full_name ?? null,
      closer_name: (s.closer as { full_name?: string } | null)?.full_name ?? null,
      cash_in: cashIn,
      cash_out: cashOut,
      cash_sales: cashSales,
    };
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Sesi Kasir" description="Riwayat sesi kasir 30 hari terakhir" />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              {!outletFilter && <TableHead>Outlet</TableHead>}
              <TableHead>Operator</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Modal Awal</TableHead>
              <TableHead className="text-right">Kas Masuk</TableHead>
              <TableHead className="text-right">Kas Keluar</TableHead>
              <TableHead className="text-right">Penjualan Tunai</TableHead>
              <TableHead className="text-right">Estimasi Akhir</TableHead>
              <TableHead className="text-right">Aktual Akhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const expected = r.opening_cash + r.cash_in - r.cash_out + r.cash_sales;
              const discrepancy = r.actual_closing_cash != null ? r.actual_closing_cash - expected : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium tabular-nums whitespace-nowrap">
                    {new Date(r.session_date).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                    <div className="text-xs text-muted-foreground">{formatDateTime(r.opened_at)}</div>
                  </TableCell>
                  {!outletFilter && (
                    <TableCell className="text-sm">{r.outlet_name ?? "—"}</TableCell>
                  )}
                  <TableCell className="text-sm">
                    <div>{r.opener_name ?? "—"}</div>
                    {r.closer_name && r.closer_name !== r.opener_name && (
                      <div className="text-xs text-muted-foreground">Ditutup: {r.closer_name}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === "open" ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">Aktif</Badge>
                    ) : (
                      <Badge variant="secondary">Ditutup</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatIDR(r.opening_cash)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-emerald-700">{formatIDR(r.cash_in)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-rose-700">{formatIDR(r.cash_out)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatIDR(r.cash_sales)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">{formatIDR(expected)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {r.actual_closing_cash != null ? (
                      <div>
                        <div>{formatIDR(r.actual_closing_cash)}</div>
                        {discrepancy != null && discrepancy !== 0 && (
                          <div className={`text-xs ${discrepancy < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {discrepancy > 0 ? "+" : ""}{formatIDR(discrepancy)}
                          </div>
                        )}
                      </div>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
