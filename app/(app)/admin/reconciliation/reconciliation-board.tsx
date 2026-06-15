"use client";

import { useMemo, useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Minus, Copy, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/format";
import type { Outlet } from "@/lib/types";
import type { ReconciliationOrder, SessionWithMovements } from "./page";

type Row = {
  destination: string;
  method: string;
  orders: number;
  expected: number;
};

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function storageKey(date: string, outletId: string) {
  return `recon:${date}:${outletId || "all"}`;
}

export function ReconciliationBoard({
  orders,
  outlets,
  sessions,
}: {
  orders: ReconciliationOrder[];
  outlets: Pick<Outlet, "id" | "name">[];
  sessions: SessionWithMovements[];
}) {
  const today = useMemo(() => new Date(), []);
  const [dateStr, setDateStr] = useState(() => toDateStr(today));
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [received, setReceived] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const [waPhone, setWaPhone] = useState("");

  // Load persisted received amounts from localStorage
  useEffect(() => {
    try {
      const key = storageKey(dateStr, selectedOutletId);
      const saved = localStorage.getItem(key);
      setReceived(saved ? JSON.parse(saved) : {});
    } catch { setReceived({}); }
  }, [dateStr, selectedOutletId]);

  function updateReceived(dest: string, value: string) {
    const next = { ...received, [dest]: value };
    setReceived(next);
    try {
      localStorage.setItem(storageKey(dateStr, selectedOutletId), JSON.stringify(next));
    } catch { /* ignore */ }
  }

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const d = new Date(o.created_at);
      const ds = toDateStr(d);
      if (ds !== dateStr) return false;
      if (selectedOutletId && o.outlet_id !== selectedOutletId) return false;
      return true;
    });
  }, [orders, dateStr, selectedOutletId]);

  const rows = useMemo((): Row[] => {
    const map = new Map<string, Row>();
    for (const o of filtered) {
      const dest = o.payment_destination ?? "Tidak ditentukan";
      const method = o.payment_method ?? "-";
      const cur = map.get(dest);
      if (cur) { cur.orders += 1; cur.expected += o.total; }
      else map.set(dest, { destination: dest, method, orders: 1, expected: o.total });
    }
    return [...map.values()].sort((a, b) => b.expected - a.expected);
  }, [filtered]);

  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
  const totalReceived = rows.reduce((s, r) => {
    const v = Number(received[r.destination]?.replace(/\D/g, "") || 0);
    return s + v;
  }, 0);
  const totalDiff = totalReceived - totalExpected;

  // Find the cashier session for the current date + outlet filter
  const currentSession = useMemo(() => {
    return sessions.find((s) => {
      if (s.session_date !== dateStr) return false;
      if (selectedOutletId && s.outlet_id !== selectedOutletId) return false;
      return true;
    }) ?? null;
  }, [sessions, dateStr, selectedOutletId]);

  const sessionCashIn = useMemo(
    () => currentSession?.movements.filter((m) => m.type === "cash_in").reduce((s, m) => s + m.amount, 0) ?? 0,
    [currentSession],
  );
  const sessionCashOut = useMemo(
    () => currentSession?.movements.filter((m) => m.type === "cash_out").reduce((s, m) => s + m.amount, 0) ?? 0,
    [currentSession],
  );
  const cashSalesTotal = useMemo(
    () => filtered.filter((o) => o.payment_method === "cash").reduce((s, o) => s + o.total, 0),
    [filtered],
  );
  const expectedClosing = currentSession
    ? currentSession.opening_cash + sessionCashIn - sessionCashOut + cashSalesTotal
    : null;

  function buildWhatsAppText() {
    const outletLabel = outlets.find((o) => o.id === selectedOutletId)?.name ?? "Semua Outlet";
    const dateLabel = new Date(dateStr).toLocaleDateString("id-ID", { dateStyle: "long" });
    const lines: string[] = [
      `*Rekap Harian — ${outletLabel}*`,
      `📅 ${dateLabel}`,
      ``,
      `*Penjualan*`,
      `• Total transaksi: ${filtered.length} pesanan`,
      `• Total penjualan: ${formatIDR(totalExpected)}`,
      ``,
      `*Pembayaran*`,
      ...rows.map((r) => `• ${r.destination}: ${formatIDR(r.expected)}`),
    ];
    if (currentSession) {
      lines.push(
        ``,
        `*Kas Kasir*`,
        `• Modal awal: ${formatIDR(currentSession.opening_cash)}`,
        ...(sessionCashIn > 0 ? [`• Kas masuk: ${formatIDR(sessionCashIn)}`] : []),
        ...(sessionCashOut > 0 ? [`• Kas keluar: ${formatIDR(sessionCashOut)}`] : []),
        `• Penjualan tunai: ${formatIDR(cashSalesTotal)}`,
        `• Estimasi saldo akhir: ${formatIDR(expectedClosing ?? 0)}`,
        ...(currentSession.actual_closing_cash != null
          ? [`• Saldo aktual: ${formatIDR(currentSession.actual_closing_cash)}`]
          : []),
        `• Status sesi: ${currentSession.status === "open" ? "Masih buka" : "Ditutup"}`,
      );
    }
    lines.push(``, `_Dibuat oleh Solusi Saji POS_`);
    return lines.join("\n");
  }

  async function copyRecap() {
    try {
      await navigator.clipboard.writeText(buildWhatsAppText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  function sendToWhatsApp() {
    const text = encodeURIComponent(buildWhatsAppText());
    const digits = waPhone.replace(/\D/g, "");
    const number = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
    window.open(`https://wa.me/${number}?text=${text}`, "_blank", "noopener,noreferrer");
    setWaDialogOpen(false);
    setWaPhone("");
  }

  const outletOptions = outlets.map((o) => ({ value: o.id, label: o.name }));
  const selectedOutletLabel = outlets.find(o => o.id === selectedOutletId)?.name ?? "Semua outlet";

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="recon-date">Tanggal</Label>
            <Input
              id="recon-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-44"
            />
          </div>

          {outletOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label>Outlet</Label>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" className="w-52 justify-between" />}>
                  <span className="truncate">{selectedOutletLabel}</span>
                  <ChevronDown className="size-4 shrink-0 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuCheckboxItem
                    checked={selectedOutletId === ""}
                    onCheckedChange={() => setSelectedOutletId("")}
                    closeOnClick
                  >
                    Semua outlet
                  </DropdownMenuCheckboxItem>
                  {outletOptions.map((o) => (
                    <DropdownMenuCheckboxItem
                      key={o.value}
                      checked={selectedOutletId === o.value}
                      onCheckedChange={() => setSelectedOutletId(o.value)}
                      closeOnClick
                    >
                      {o.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => {
              const d = new Date(dateStr);
              d.setDate(d.getDate() - 1);
              setDateStr(toDateStr(d));
            }}>← Kemarin</Button>
            <Button variant="outline" size="sm" onClick={() => setDateStr(toDateStr(today))}>Hari ini</Button>
          </div>
        </div>
      </Card>

      {/* Summary KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 space-y-1">
          <div className="text-xs text-muted-foreground">Total tercatat</div>
          <div className="text-2xl font-semibold tabular-nums">{formatIDR(totalExpected)}</div>
          <div className="text-xs text-muted-foreground">{filtered.length} transaksi lunas</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-xs text-muted-foreground">Total diterima (input)</div>
          <div className="text-2xl font-semibold tabular-nums">{formatIDR(totalReceived)}</div>
        </Card>
        <Card className={`p-4 space-y-1 ${totalDiff === 0 && totalExpected > 0 ? "border-emerald-500" : totalDiff !== 0 ? "border-destructive" : ""}`}>
          <div className="text-xs text-muted-foreground">Selisih</div>
          <div className={`text-2xl font-semibold tabular-nums ${totalDiff > 0 ? "text-emerald-600" : totalDiff < 0 ? "text-destructive" : ""}`}>
            {totalDiff > 0 ? "+" : ""}{formatIDR(totalDiff)}
          </div>
          <div className="text-xs text-muted-foreground">
            {totalDiff === 0 && totalExpected > 0 ? "✓ Cocok" : totalDiff !== 0 && totalExpected > 0 ? "Periksa selisih" : "-"}
          </div>
        </Card>
      </div>

      {/* Cashier session panel */}
      {currentSession && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Sesi Kasir</div>
            <Badge variant={currentSession.status === "open" ? "outline" : "secondary"}
              className={currentSession.status === "open" ? "text-emerald-600 border-emerald-300 bg-emerald-50" : ""}>
              {currentSession.status === "open" ? "Aktif" : "Ditutup"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div className="text-muted-foreground">Modal awal</div>
            <div className="text-right tabular-nums font-medium">{formatIDR(currentSession.opening_cash)}</div>
            {sessionCashIn > 0 && <>
              <div className="text-muted-foreground">+ Kas masuk</div>
              <div className="text-right tabular-nums text-emerald-700">{formatIDR(sessionCashIn)}</div>
            </>}
            {sessionCashOut > 0 && <>
              <div className="text-muted-foreground">− Kas keluar</div>
              <div className="text-right tabular-nums text-rose-700">{formatIDR(sessionCashOut)}</div>
            </>}
            <div className="text-muted-foreground">+ Penjualan tunai</div>
            <div className="text-right tabular-nums">{formatIDR(cashSalesTotal)}</div>
            <Separator className="col-span-2 my-0.5" />
            <div className="font-medium">Estimasi saldo akhir</div>
            <div className="text-right tabular-nums font-semibold">{formatIDR(expectedClosing ?? 0)}</div>
            {currentSession.actual_closing_cash != null && <>
              <div className="text-muted-foreground">Saldo aktual</div>
              <div className="text-right tabular-nums">{formatIDR(currentSession.actual_closing_cash)}</div>
              <div className="text-muted-foreground">Selisih</div>
              <div className={`text-right tabular-nums font-medium ${
                currentSession.actual_closing_cash - (expectedClosing ?? 0) < 0 ? "text-destructive" :
                currentSession.actual_closing_cash - (expectedClosing ?? 0) > 0 ? "text-emerald-600" : ""
              }`}>
                {currentSession.actual_closing_cash - (expectedClosing ?? 0) > 0 ? "+" : ""}
                {formatIDR(currentSession.actual_closing_cash - (expectedClosing ?? 0))}
              </div>
            </>}
          </div>
        </Card>
      )}

      {/* WhatsApp recap */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={copyRecap}
          disabled={filtered.length === 0}
          className="gap-2"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? "Tersalin!" : "Salin Rekap"}
        </Button>
        <Button
          size="sm"
          onClick={() => setWaDialogOpen(true)}
          disabled={filtered.length === 0}
          className="gap-2 bg-[#25D366] hover:bg-[#1da750] text-white"
        >
          <MessageCircle className="h-4 w-4" />
          Kirim ke WhatsApp
        </Button>
      </div>

      <Dialog open={waDialogOpen} onOpenChange={setWaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kirim Rekap ke WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="wa-phone">Nomor WhatsApp</Label>
            <Input
              id="wa-phone"
              type="tel"
              placeholder="08xx atau +62xx"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && waPhone.trim()) sendToWhatsApp(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setWaDialogOpen(false); setWaPhone(""); }}>
              Batal
            </Button>
            <Button
              onClick={sendToWhatsApp}
              disabled={!waPhone.trim()}
              className="gap-2 bg-[#25D366] hover:bg-[#1da750] text-white"
            >
              <MessageCircle className="h-4 w-4" />
              Kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Breakdown table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="font-medium">Rekap per Sumber Pembayaran</div>
          <p className="text-xs text-muted-foreground">Isi kolom "Diterima" dengan jumlah aktual dari setiap rekening/sumber.</p>
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Tidak ada transaksi lunas untuk tanggal dan outlet ini.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sumber Pembayaran</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead className="text-right">Transaksi</TableHead>
                <TableHead className="text-right">Tercatat</TableHead>
                <TableHead className="text-right w-44">Diterima (Rp)</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
                <TableHead className="text-center w-10">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const recvRaw = received[row.destination] ?? "";
                const recvNum = Number(recvRaw.replace(/\D/g, "") || 0);
                const diff = recvRaw === "" ? null : recvNum - row.expected;
                return (
                  <TableRow key={row.destination}>
                    <TableCell className="font-medium">{row.destination}</TableCell>
                    <TableCell className="text-sm text-muted-foreground uppercase">{row.method}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.orders}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatIDR(row.expected)}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        className="w-36 text-right tabular-nums ml-auto"
                        placeholder="0"
                        value={recvRaw}
                        onChange={(e) => updateReceived(row.destination, e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {diff === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={diff > 0 ? "text-emerald-600" : diff < 0 ? "text-destructive" : ""}>
                          {diff > 0 ? "+" : ""}{formatIDR(diff)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {diff === null ? (
                        <Minus className="size-4 text-muted-foreground mx-auto" />
                      ) : diff === 0 ? (
                        <CheckCircle2 className="size-4 text-emerald-600 mx-auto" />
                      ) : (
                        <AlertCircle className="size-4 text-destructive mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={3} className="font-medium">Total</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatIDR(totalExpected)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{totalReceived > 0 ? formatIDR(totalReceived) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {totalReceived > 0 ? (
                    <span className={totalDiff > 0 ? "text-emerald-600" : totalDiff < 0 ? "text-destructive" : ""}>
                      {totalDiff > 0 ? "+" : ""}{formatIDR(totalDiff)}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-center">
                  {totalReceived > 0 ? (
                    totalDiff === 0
                      ? <CheckCircle2 className="size-4 text-emerald-600 mx-auto" />
                      : <AlertCircle className="size-4 text-destructive mx-auto" />
                  ) : <Minus className="size-4 text-muted-foreground mx-auto" />}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Card>

      {/* Order detail */}
      {filtered.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b">
            <div className="font-medium">Rincian transaksi hari ini</div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Pesanan</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Tujuan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 50).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                  <TableCell className="text-sm">{o.outlet_name ?? <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell className="text-sm">{o.payment_destination ?? <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>
                    <Badge variant="default" className="text-xs">Lunas</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatIDR(o.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 50 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t">
              Menampilkan 50 dari {filtered.length} transaksi.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
