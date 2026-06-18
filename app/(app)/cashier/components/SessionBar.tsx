"use client";

import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CashMovementModal } from "./CashMovementModal";
import { CashLedgerDialog } from "./CashLedgerDialog";
import { CloseSessionModal } from "./CloseSessionModal";
import type { CashierSession } from "@/lib/types";
import type { CashMovementWithActor } from "../session-actions";
import { formatIDR, formatTime } from "@/lib/format";

type Props = {
  session: CashierSession;
  movements: CashMovementWithActor[];
};

export function SessionBar({ session, movements }: Props) {
  const [modal, setModal] = useState<"cash_in" | "cash_out" | "close" | null>(null);

  const cashIn = movements.filter((m) => m.type === "cash_in").reduce((s, m) => s + m.amount, 0);
  const cashOut = movements.filter((m) => m.type === "cash_out").reduce((s, m) => s + m.amount, 0);

  return (
    <>
      <div className="rounded-xl border bg-card px-4 py-3 mb-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">
              Sesi aktif
            </Badge>
            <span className="text-xs text-muted-foreground">
              Dibuka {formatTime(session.opened_at)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CashLedgerDialog movements={movements} />
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/5 h-7 text-xs"
              onClick={() => setModal("close")}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Tutup Sesi
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-muted/50 px-2 py-1.5">
            <div className="text-xs text-muted-foreground mb-0.5">Modal awal</div>
            <div className="text-sm font-semibold tabular-nums">{formatIDR(session.opening_cash)}</div>
          </div>
          <div className="rounded-md bg-emerald-50 px-2 py-1.5">
            <div className="text-xs text-emerald-600 mb-0.5">Kas masuk</div>
            <div className="text-sm font-semibold tabular-nums text-emerald-700">{formatIDR(cashIn)}</div>
          </div>
          <div className="rounded-md bg-rose-50 px-2 py-1.5">
            <div className="text-xs text-rose-600 mb-0.5">Kas keluar</div>
            <div className="text-sm font-semibold tabular-nums text-rose-700">{formatIDR(cashOut)}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8"
            onClick={() => setModal("cash_in")}
          >
            <ArrowDownCircle className="h-3.5 w-3.5 mr-1.5" />
            Kas Masuk
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-rose-700 border-rose-300 hover:bg-rose-50 h-8"
            onClick={() => setModal("cash_out")}
          >
            <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" />
            Kas Keluar
          </Button>
        </div>
      </div>

      {modal === "cash_in" && (
        <CashMovementModal sessionId={session.id} type="cash_in" onClose={() => setModal(null)} />
      )}
      {modal === "cash_out" && (
        <CashMovementModal sessionId={session.id} type="cash_out" onClose={() => setModal(null)} />
      )}
      {modal === "close" && (
        <CloseSessionModal session={session} onClose={() => setModal(null)} />
      )}
    </>
  );
}
