"use client";

import { ArrowDownCircle, ArrowUpCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatIDR, formatTime } from "@/lib/format";
import { CASH_MOVEMENT_CATEGORY_LABEL } from "@/lib/types";
import type { CashMovementWithActor } from "../session-actions";

export function CashLedgerDialog({
  movements,
}: {
  movements: CashMovementWithActor[];
}) {
  const cashIn = movements.filter((m) => m.type === "cash_in").reduce((s, m) => s + m.amount, 0);
  const cashOut = movements.filter((m) => m.type === "cash_out").reduce((s, m) => s + m.amount, 0);

  return (
    <Dialog>
      <DialogTrigger
        render={<Button size="sm" variant="outline" className="h-7 text-xs" />}
      >
        <FileText className="h-3.5 w-3.5 mr-1.5" />
        Riwayat kas
        <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 text-[10px]">
          {movements.length}
        </Badge>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Riwayat kas — sesi aktif</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 text-center mb-1">
          <div className="rounded-md bg-emerald-50 px-2 py-1.5">
            <div className="text-xs text-emerald-600 mb-0.5">Total kas masuk</div>
            <div className="text-sm font-semibold tabular-nums text-emerald-700">{formatIDR(cashIn)}</div>
          </div>
          <div className="rounded-md bg-rose-50 px-2 py-1.5">
            <div className="text-xs text-rose-600 mb-0.5">Total kas keluar</div>
            <div className="text-sm font-semibold tabular-nums text-rose-700">{formatIDR(cashOut)}</div>
          </div>
        </div>

        {movements.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Belum ada pergerakan kas pada sesi ini.
          </div>
        ) : (
          <div className="border rounded-md max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Waktu</th>
                  <th className="px-3 py-2 font-medium">Kategori</th>
                  <th className="px-3 py-2 font-medium">Catatan</th>
                  <th className="px-3 py-2 font-medium">Oleh</th>
                  <th className="px-3 py-2 font-medium text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const Icon = m.type === "cash_in" ? ArrowDownCircle : ArrowUpCircle;
                  const tone =
                    m.type === "cash_in"
                      ? "text-emerald-700"
                      : "text-rose-700";
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatTime(m.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Icon className={`h-3.5 w-3.5 ${tone}`} />
                          {CASH_MOVEMENT_CATEGORY_LABEL[m.category] ?? m.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {m.notes ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {m.actor_name ?? "—"}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${tone}`}>
                        {m.type === "cash_in" ? "+" : "−"}
                        {formatIDR(m.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
