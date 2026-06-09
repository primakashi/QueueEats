"use client";

import { useMemo, useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { ReconciliationOrder } from "./page";

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
}: {
  orders: ReconciliationOrder[];
  outlets: Pick<Outlet, "id" | "name">[];
}) {
  const today = useMemo(() => new Date(), []);
  const [dateStr, setDateStr] = useState(() => toDateStr(today));
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  // received amounts keyed by destination label
  const [received, setReceived] = useState<Record<string, string>>({});

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

      {/* Breakdown table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="font-medium">Rekap per tujuan pembayaran</div>
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
                <TableHead>Tujuan pembayaran</TableHead>
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
