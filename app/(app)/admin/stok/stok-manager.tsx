"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleDot,
  Image as ImageIcon,
  Minus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { STOCK_REASON_LABEL } from "@/lib/types";
import {
  addStock,
  confirmDailyStock,
  toggleStockActive,
  updateOpeningStock,
} from "./actions";
import type { StockSnapshot } from "./actions";

type FilterKey = "all" | "available" | "low" | "out";

function classifyStatus(
  current: number,
  low: number,
  is_active: boolean,
): "available" | "low" | "out" | "disabled" {
  if (!is_active) return "disabled";
  if (current <= 0) return "out";
  if (current <= low) return "low";
  return "available";
}

function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

export function StokManager({ snapshot }: { snapshot: StockSnapshot }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showAllLog, setShowAllLog] = useState(false);

  const counts = useMemo(() => {
    let available = 0, low = 0, out = 0, disabled = 0;
    for (const it of snapshot.items) {
      const s = classifyStatus(it.daily_stock.current_stock, it.low_threshold, it.daily_stock.is_active);
      if (s === "available") available++;
      else if (s === "low") low++;
      else if (s === "out") out++;
      else disabled++;
    }
    return { available, low, outOrDisabled: out + disabled };
  }, [snapshot.items]);

  const filtered = useMemo(() => {
    if (filter === "all") return snapshot.items;
    return snapshot.items.filter((it) => {
      const s = classifyStatus(it.daily_stock.current_stock, it.low_threshold, it.daily_stock.is_active);
      if (filter === "available") return s === "available";
      if (filter === "low") return s === "low";
      return s === "out" || s === "disabled";
    });
  }, [snapshot.items, filter]);

  const sumQuota = snapshot.items.reduce((s, it) => s + (it.effective_quota ?? 0), 0);
  const sumOpening = snapshot.items.reduce((s, it) => s + it.daily_stock.opening_stock, 0);
  const sumCurrent = snapshot.items.reduce((s, it) => s + it.daily_stock.current_stock, 0);

  const anyUnconfirmed = snapshot.items.some((it) => !it.daily_stock.confirmed_at);
  const [pending, start] = useTransition();

  function handleConfirm() {
    start(async () => {
      const res = await confirmDailyStock(snapshot.outlet_id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Stok hari ini dikonfirmasi");
        router.refresh();
      }
    });
  }

  const visibleLog = showAllLog ? snapshot.movements : snapshot.movements.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 gap-1.5">
            <CircleDot className="size-3" />
            Sesi aktif · {dayLabel(snapshot.date)}
          </Badge>
          {snapshot.outlet_name && (
            <span className="text-xs text-muted-foreground">· {snapshot.outlet_name}</span>
          )}
        </div>
      </div>

      {/* Status chips + filter chips */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusChip color="emerald" label={`${counts.available} Tersedia`} />
          <StatusChip color="amber" label={`${counts.low} Hampir habis`} />
          <StatusChip color="rose" label={`${counts.outOrDisabled} Habis / nonaktif`} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">Filter:</span>
          <FilterChip on={filter === "all"} onClick={() => setFilter("all")}>Semua</FilterChip>
          <FilterChip on={filter === "available"} onClick={() => setFilter("available")}>Tersedia</FilterChip>
          <FilterChip on={filter === "low"} onClick={() => setFilter("low")}>Hampir habis</FilterChip>
          <FilterChip on={filter === "out"} onClick={() => setFilter("out")}>Habis</FilterChip>
        </div>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden gap-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="px-4 py-3 font-medium">Item menu</th>
                <th className="px-3 py-3 font-medium text-center">Kuota/hari</th>
                <th className="px-3 py-3 font-medium text-center">Stok awal</th>
                <th className="px-3 py-3 font-medium text-center">Sisa</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-sm text-muted-foreground py-12">
                    Tidak ada item untuk filter ini.
                  </td>
                </tr>
              ) : (
                filtered.map((it) => <StokRow key={it.daily_stock.id} item={it} />)
              )}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t text-sm font-medium">
                <td className="px-4 py-3">{snapshot.items.length} item</td>
                <td className="px-3 py-3 text-center tabular-nums">{sumQuota}</td>
                <td className="px-3 py-3 text-center tabular-nums">{sumOpening}</td>
                <td className="px-3 py-3 text-center tabular-nums text-emerald-700">{sumCurrent}</td>
                <td />
                <td className="px-3 py-3 text-right">
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    disabled={pending || !anyUnconfirmed}
                    aria-busy={pending}
                  >
                    <Check className="size-4 mr-1" />
                    {anyUnconfirmed ? "Konfirmasi" : "Sudah dikonfirmasi"}
                  </Button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Log */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Log Stok</h3>
            <p className="text-xs text-muted-foreground">Riwayat penambahan dan pengurangan stok hari ini</p>
          </div>
          {snapshot.movements.length > 6 && (
            <Button variant="outline" size="sm" onClick={() => setShowAllLog((v) => !v)}>
              {showAllLog ? "Tampilkan ringkas" : "Lihat semua"}
            </Button>
          )}
        </div>
        <Card className="p-0 overflow-hidden gap-0">
          {snapshot.movements.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Belum ada perubahan stok hari ini.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-3 py-3 font-medium">Waktu</th>
                  <th className="px-3 py-3 font-medium text-right">Perubahan</th>
                  <th className="px-3 py-3 font-medium text-right">Sisa</th>
                  <th className="px-3 py-3 font-medium">Alasan</th>
                  <th className="px-3 py-3 font-medium">Oleh</th>
                </tr>
              </thead>
              <tbody>
                {visibleLog.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <span
                        className={`inline-block size-2 rounded-full mr-2 align-middle ${
                          m.change > 0 ? "bg-emerald-500" : m.change < 0 ? "bg-rose-500" : "bg-zinc-400"
                        }`}
                      />
                      {m.menu_name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground tabular-nums">{timeLabel(m.created_at)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums font-medium ${
                      m.change > 0 ? "text-emerald-600" : m.change < 0 ? "text-rose-600" : "text-muted-foreground"
                    }`}>
                      {m.change > 0 ? "+" : ""}{m.change}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{m.resulting_stock}</td>
                    <td className="px-3 py-3 text-xs">
                      <Badge variant="outline">{STOCK_REASON_LABEL[m.reason]}</Badge>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{m.actor_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatusChip({ color, label }: { color: "emerald" | "amber" | "rose"; label: string }) {
  const colorClass = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  }[color];
  const dot = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 border ${colorClass}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs rounded-md px-3 py-1.5 transition-colors border ${
        on
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-background text-foreground hover:bg-muted border-border"
      }`}
    >
      {children}
    </button>
  );
}

function StokRow({ item }: { item: StockSnapshot["items"][number] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [quotaStr, setQuotaStr] = useState<string>(item.effective_quota?.toString() ?? "");
  const [openingStr, setOpeningStr] = useState<string>(item.daily_stock.opening_stock.toString());

  const status = classifyStatus(
    item.daily_stock.current_stock,
    item.low_threshold,
    item.daily_stock.is_active,
  );

  const confirmed = !!item.daily_stock.confirmed_at;

  function persistOpening(nextOpening: number, nextQuota: number | null) {
    start(async () => {
      const res = await updateOpeningStock(item.daily_stock.id, nextOpening, nextQuota);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function quotaChange(delta: number) {
    const next = Math.max(0, (Number(quotaStr) || 0) + delta);
    setQuotaStr(String(next));
    persistOpening(Number(openingStr) || 0, next);
  }

  function openingChange(delta: number) {
    const next = Math.max(0, (Number(openingStr) || 0) + delta);
    setOpeningStr(String(next));
    persistOpening(next, quotaStr === "" ? null : Number(quotaStr));
  }

  function addOne() {
    start(async () => {
      const res = await addStock(item.daily_stock.id, 1, "add");
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function toggleActive() {
    start(async () => {
      const res = await toggleStockActive(item.daily_stock.id, !item.daily_stock.is_active);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(item.daily_stock.is_active ? "Item dinonaktifkan" : "Item diaktifkan");
        router.refresh();
      }
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-md bg-muted/40 border grid place-items-center shrink-0 overflow-hidden">
            {item.menu_item.image_url ? (
              <Image
                src={item.menu_item.image_url}
                alt={item.menu_item.name}
                width={40}
                height={40}
                sizes="40px"
                className="size-10 object-cover"
              />
            ) : (
              <ImageIcon className="size-4 text-muted-foreground/50" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{item.menu_item.name}</div>
            <div className="text-xs text-muted-foreground truncate">{item.category_name ?? "—"}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <Stepper
          value={quotaStr}
          onChange={(v) => setQuotaStr(v)}
          onCommit={(v) => persistOpening(Number(openingStr) || 0, v === "" ? null : Number(v))}
          onDelta={(d) => quotaChange(d)}
          disabled={confirmed || pending}
        />
      </td>
      <td className="px-3 py-3">
        <Stepper
          value={openingStr}
          onChange={(v) => setOpeningStr(v)}
          onCommit={(v) => persistOpening(Number(v) || 0, quotaStr === "" ? null : Number(quotaStr))}
          onDelta={(d) => openingChange(d)}
          disabled={confirmed || pending}
        />
      </td>
      <td className="px-3 py-3 text-center">
        <span
          className={`font-semibold tabular-nums ${
            status === "out" || status === "disabled"
              ? "text-rose-600"
              : status === "low"
              ? "text-amber-600"
              : "text-emerald-600"
          }`}
        >
          {item.daily_stock.current_stock}
        </span>
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={status} />
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            onClick={addOne}
            disabled={pending || !item.daily_stock.is_active}
          >
            <Plus className="size-3 mr-1" />
            Tambah
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={toggleActive}
            disabled={pending}
          >
            {item.daily_stock.is_active ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: "available" | "low" | "out" | "disabled" }) {
  if (status === "disabled") {
    return <Badge variant="outline" className="text-zinc-600 bg-zinc-100 border-zinc-200">Dinonaktifkan</Badge>;
  }
  if (status === "out") {
    return <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-200">Habis</Badge>;
  }
  if (status === "low") {
    return <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">Hampir habis</Badge>;
  }
  return <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">Tersedia</Badge>;
}

function Stepper({
  value,
  onChange,
  onCommit,
  onDelta,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  onDelta: (delta: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-7 w-7"
        onClick={() => onDelta(-1)}
        disabled={disabled}
        aria-label="Kurangi"
      >
        <Minus className="size-3" />
      </Button>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={(e) => onCommit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-7 w-14 text-center px-1 tabular-nums"
        inputMode="numeric"
        disabled={disabled}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-7 w-7"
        onClick={() => onDelta(1)}
        disabled={disabled}
        aria-label="Tambah"
      >
        <Plus className="size-3" />
      </Button>
    </div>
  );
}
