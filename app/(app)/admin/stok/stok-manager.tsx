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
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { STOCK_REASON_LABEL } from "@/lib/types";
import {
  addStock,
  confirmDailyStock,
  setOutletDailyQuota,
  toggleStockActive,
  updateOpeningStock,
} from "./actions";
import type { StockSnapshot } from "./actions";

type FilterKey = "all" | "available" | "low" | "out";
type StageKey = "default" | "opening" | "ops";

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
  const allConfirmed =
    snapshot.items.length > 0 && snapshot.items.every((it) => !!it.daily_stock.confirmed_at);
  // Default the user to the most natural stage for the current state of the day.
  const [stage, setStage] = useState<StageKey>(allConfirmed ? "ops" : "opening");

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 gap-1.5">
            <CircleDot className="size-3" />
            Sesi · {dayLabel(snapshot.date)}
          </Badge>
          {snapshot.outlet_name && (
            <span className="text-xs text-muted-foreground">· {snapshot.outlet_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusChip color="emerald" label={`${counts.available} Tersedia`} />
          <StatusChip color="amber" label={`${counts.low} Hampir habis`} />
          <StatusChip color="rose" label={`${counts.outOrDisabled} Habis / nonaktif`} />
        </div>
      </div>

      <StageTabs stage={stage} setStage={setStage} allConfirmed={allConfirmed} />

      {stage === "default" && <DefaultStage snapshot={snapshot} />}
      {stage === "opening" && <OpeningStage snapshot={snapshot} allConfirmed={allConfirmed} />}
      {stage === "ops" && <OperationalStage snapshot={snapshot} allConfirmed={allConfirmed} />}
    </div>
  );
}

// =============================================================================
// Stage navigation
// =============================================================================

function StageTabs({
  stage,
  setStage,
  allConfirmed,
}: {
  stage: StageKey;
  setStage: (s: StageKey) => void;
  allConfirmed: boolean;
}) {
  const tabs: Array<{ id: StageKey; n: number; label: string; hint: string; state: "done" | "active" | "todo" }> = [
    {
      id: "default",
      n: 1,
      label: "Default Stok",
      hint: "Patokan harian per outlet",
      state: stage === "default" ? "active" : "done",
    },
    {
      id: "opening",
      n: 2,
      label: "Stok Awal Hari Ini",
      hint: allConfirmed ? "Sudah dikonfirmasi" : "Konfirmasi stok aktual",
      state: stage === "opening" ? "active" : allConfirmed ? "done" : "todo",
    },
    {
      id: "ops",
      n: 3,
      label: "Operasional",
      hint: "Tambah/kurangi & pantau sisa",
      state: stage === "ops" ? "active" : "todo",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setStage(t.id)}
          className={`group text-left rounded-xl border px-4 py-3 transition-colors ${
            stage === t.id
              ? "border-primary bg-primary/5"
              : t.state === "done"
              ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50"
              : "bg-card hover:bg-muted"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                stage === t.id
                  ? "bg-primary text-primary-foreground"
                  : t.state === "done"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {t.state === "done" && stage !== t.id ? <Check className="size-3.5" /> : t.n}
            </span>
            <div className="font-medium text-sm">{t.label}</div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground pl-8">{t.hint}</p>
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Stage 1 — Default
// =============================================================================

function DefaultStage({ snapshot }: { snapshot: StockSnapshot }) {
  return (
    <Card className="p-0 overflow-hidden gap-0">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Default stok per outlet</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Kuota harian yang akan dijadikan stok awal otomatis. Sesuaikan jika kebutuhan outlet ini berbeda dari standar.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b">
              <th className="px-4 py-3 font-medium">Item menu</th>
              <th className="px-3 py-3 font-medium text-center">Default kuota/hari</th>
              <th className="px-3 py-3 font-medium text-center text-muted-foreground/80">
                Kemarin (awal → sisa)
              </th>
            </tr>
          </thead>
          <tbody>
            {snapshot.items.map((it) => (
              <DefaultRow key={it.menu_item.id} outletId={snapshot.outlet_id} item={it} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DefaultRow({
  outletId,
  item,
}: {
  outletId: string;
  item: StockSnapshot["items"][number];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [quotaStr, setQuotaStr] = useState<string>(item.effective_quota?.toString() ?? "");

  function persist(next: string) {
    const parsed = next.trim() === "" ? null : Math.max(0, Math.floor(Number(next) || 0));
    start(async () => {
      try {
        const res = await setOutletDailyQuota(outletId, item.menu_item.id, parsed);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success("Default disimpan");
          router.refresh();
        }
      } catch (err) {
        console.error("[stok] setOutletDailyQuota threw", err);
        toast.error("Gagal menyimpan default. Coba lagi.");
      }
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <MenuCell item={item} />
      </td>
      <td className="px-3 py-3 text-center">
        <Stepper
          value={quotaStr}
          onChange={setQuotaStr}
          onCommit={persist}
          onDelta={(d) => {
            const next = Math.max(0, (Number(quotaStr) || 0) + d).toString();
            setQuotaStr(next);
            persist(next);
          }}
          disabled={pending}
        />
      </td>
      <td className="px-3 py-3 text-center text-xs text-muted-foreground tabular-nums">
        {item.yesterday_opening != null && item.yesterday_closing != null
          ? `${item.yesterday_opening} → ${item.yesterday_closing}`
          : "—"}
      </td>
    </tr>
  );
}

// =============================================================================
// Stage 2 — Opening (today's actual)
// =============================================================================

function OpeningStage({
  snapshot,
  allConfirmed,
}: {
  snapshot: StockSnapshot;
  allConfirmed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const sumOpening = snapshot.items.reduce((s, it) => s + it.daily_stock.opening_stock, 0);
  const sumDefault = snapshot.items.reduce((s, it) => s + (it.effective_quota ?? 0), 0);

  function handleConfirm() {
    start(async () => {
      try {
        const res = await confirmDailyStock(snapshot.outlet_id);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success("Stok hari ini dikonfirmasi");
          router.refresh();
        }
      } catch (err) {
        console.error("[stok] confirmDailyStock threw", err);
        toast.error("Gagal mengkonfirmasi stok. Coba lagi.");
      }
    });
  }

  return (
    <Card className="p-0 overflow-hidden gap-0">
      <div className="p-4 border-b flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold">Stok awal hari ini</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Catat stok aktual saat buka. Default dipakai jika tidak diubah. Konfirmasi mengunci nilai ini.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={pending || allConfirmed}
          aria-busy={pending}
        >
          {allConfirmed ? (
            <>
              <Lock className="size-4 mr-1" /> Sudah dikonfirmasi
            </>
          ) : (
            <>
              <Check className="size-4 mr-1" /> Konfirmasi stok hari ini
            </>
          )}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b">
              <th className="px-4 py-3 font-medium">Item menu</th>
              <th className="px-3 py-3 font-medium text-center text-muted-foreground/80">
                Kemarin (sisa)
              </th>
              <th className="px-3 py-3 font-medium text-center">Default</th>
              <th className="px-3 py-3 font-medium text-center">Stok awal hari ini</th>
              <th className="px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.items.map((it) => (
              <OpeningRow key={it.menu_item.id} item={it} />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 border-t text-sm font-medium">
              <td className="px-4 py-3">{snapshot.items.length} item</td>
              <td />
              <td className="px-3 py-3 text-center tabular-nums">{sumDefault}</td>
              <td className="px-3 py-3 text-center tabular-nums">{sumOpening}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function OpeningRow({ item }: { item: StockSnapshot["items"][number] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Autofill: if opening_stock was never manually set (equals quota or is 0),
  // initialise the input with the effective_quota so staff can see the default.
  const initialValue = item.daily_stock.opening_stock > 0
    ? item.daily_stock.opening_stock.toString()
    : (item.effective_quota ?? 0).toString();
  const [openingStr, setOpeningStr] = useState<string>(initialValue);
  const confirmed = !!item.daily_stock.confirmed_at;

  function persist(next: string) {
    const parsed = Math.max(0, Math.floor(Number(next) || 0));
    start(async () => {
      try {
        const res = await updateOpeningStock(
          item.daily_stock.id,
          parsed,
          item.effective_quota,
        );
        if (!res.ok) toast.error(res.error);
        else router.refresh();
      } catch (err) {
        console.error("[stok] updateOpeningStock threw", err);
        toast.error("Gagal menyimpan stok awal. Coba lagi.");
      }
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <MenuCell item={item} />
      </td>
      <td className="px-3 py-3 text-center text-xs text-muted-foreground tabular-nums">
        {item.yesterday_closing ?? "—"}
      </td>
      <td className="px-3 py-3 text-center text-xs text-muted-foreground tabular-nums">
        {item.effective_quota ?? "—"}
      </td>
      <td className="px-3 py-3 text-center">
        <Stepper
          value={openingStr}
          onChange={setOpeningStr}
          onCommit={persist}
          onDelta={(d) => {
            const next = Math.max(0, (Number(openingStr) || 0) + d).toString();
            setOpeningStr(next);
            persist(next);
          }}
          disabled={pending}
        />
      </td>
      <td className="px-3 py-3">
        {confirmed ? (
          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 gap-1">
            <Lock className="size-3" /> Dikonfirmasi
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
            Menunggu konfirmasi
          </Badge>
        )}
      </td>
    </tr>
  );
}

// =============================================================================
// Stage 3 — Operational
// =============================================================================

function OperationalStage({
  snapshot,
  allConfirmed,
}: {
  snapshot: StockSnapshot;
  allConfirmed: boolean;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showAllLog, setShowAllLog] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "all") return snapshot.items;
    return snapshot.items.filter((it) => {
      const s = classifyStatus(it.daily_stock.current_stock, it.low_threshold, it.daily_stock.is_active);
      if (filter === "available") return s === "available";
      if (filter === "low") return s === "low";
      return s === "out" || s === "disabled";
    });
  }, [snapshot.items, filter]);

  const visibleLog = showAllLog ? snapshot.movements : snapshot.movements.slice(0, 8);

  return (
    <div className="space-y-6">
      {!allConfirmed && (
        <Card className="p-3 bg-amber-50/60 border-amber-200 text-amber-900 text-xs">
          Stok hari ini belum dikonfirmasi. Selesaikan tahap 2 terlebih dahulu untuk hasil yang konsisten.
        </Card>
      )}

      <Card className="p-0 overflow-hidden gap-0">
        <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold">Operasional hari ini</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tambah penerimaan baru atau kurangi karena rusak/koreksi. Penjualan otomatis tercatat.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-2">Filter:</span>
            <FilterChip on={filter === "all"} onClick={() => setFilter("all")}>Semua</FilterChip>
            <FilterChip on={filter === "available"} onClick={() => setFilter("available")}>Tersedia</FilterChip>
            <FilterChip on={filter === "low"} onClick={() => setFilter("low")}>Hampir habis</FilterChip>
            <FilterChip on={filter === "out"} onClick={() => setFilter("out")}>Habis</FilterChip>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="px-4 py-3 font-medium">Item menu</th>
                <th className="px-3 py-3 font-medium text-center">Stok awal</th>
                <th className="px-3 py-3 font-medium text-center">Sisa</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-sm text-muted-foreground py-12">
                    Tidak ada item untuk filter ini.
                  </td>
                </tr>
              ) : (
                filtered.map((it) => <OperationalRow key={it.daily_stock.id} item={it} />)
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Log Stok</h3>
            <p className="text-xs text-muted-foreground">Riwayat perubahan stok hari ini</p>
          </div>
          {snapshot.movements.length > 8 && (
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
                    <td
                      className={`px-3 py-3 text-right tabular-nums font-medium ${
                        m.change > 0 ? "text-emerald-600" : m.change < 0 ? "text-rose-600" : "text-muted-foreground"
                      }`}
                    >
                      {m.change > 0 ? "+" : ""}
                      {m.change}
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

function OperationalRow({ item }: { item: StockSnapshot["items"][number] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const status = classifyStatus(
    item.daily_stock.current_stock,
    item.low_threshold,
    item.daily_stock.is_active,
  );

  function toggleActive() {
    start(async () => {
      try {
        const res = await toggleStockActive(item.daily_stock.id, !item.daily_stock.is_active);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success(item.daily_stock.is_active ? "Item dinonaktifkan" : "Item diaktifkan");
          router.refresh();
        }
      } catch (err) {
        console.error("[stok] toggleStockActive threw", err);
        toast.error("Gagal mengubah status. Coba lagi.");
      }
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <MenuCell item={item} />
      </td>
      <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">
        {item.daily_stock.opening_stock}
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
          <AdjustStockDialog
            kind="add"
            dailyStockId={item.daily_stock.id}
            currentStock={item.daily_stock.current_stock}
            menuName={item.menu_item.name}
            disabled={!item.daily_stock.is_active}
          />
          <AdjustStockDialog
            kind="remove"
            dailyStockId={item.daily_stock.id}
            currentStock={item.daily_stock.current_stock}
            menuName={item.menu_item.name}
            disabled={!item.daily_stock.is_active || item.daily_stock.current_stock <= 0}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={toggleActive}
            disabled={pending}
          >
            {item.daily_stock.is_active ? "Nonaktif" : "Aktif"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AdjustStockDialog({
  kind,
  dailyStockId,
  currentStock,
  menuName,
  disabled,
}: {
  kind: "add" | "remove";
  dailyStockId: string;
  currentStock: number;
  menuName: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();

  const label = kind === "add" ? "Tambah" : "Kurangi";
  const Icon = kind === "add" ? Plus : Minus;
  const colorCls =
    kind === "add"
      ? "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
      : "text-rose-700 border-rose-200 hover:bg-rose-50";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (n <= 0) {
      toast.error("Jumlah harus lebih dari 0");
      return;
    }
    start(async () => {
      try {
        const res = await addStock(dailyStockId, n, kind, notes || undefined);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(`${label} ${n} berhasil`);
        setOpen(false);
        setAmount("");
        setNotes("");
        router.refresh();
      } catch (err) {
        console.error("[stok] addStock threw", err);
        toast.error("Gagal menyimpan stok. Coba lagi.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className={`h-8 text-xs ${colorCls}`} disabled={disabled} />
        }
      >
        <Icon className="size-3 mr-1" />
        {label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {label} stok · {menuName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Sisa saat ini: <span className="font-semibold text-foreground tabular-nums">{currentStock}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-amount">Jumlah</Label>
            <Input
              id="adj-amount"
              type="number"
              min={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-notes">
              Catatan <span className="text-muted-foreground font-normal">(opsional)</span>
            </Label>
            <Input
              id="adj-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={kind === "add" ? "mis. penerimaan supplier" : "mis. rusak / tumpah"}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
            {pending ? "Menyimpan…" : `${label} stok`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Shared bits
// =============================================================================

function MenuCell({ item }: { item: StockSnapshot["items"][number] }) {
  return (
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
