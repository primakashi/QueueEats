"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  CircleDot,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  Minus,
  PackageCheck,
  Plus,
  Lock,
  Search,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700">
                <CalendarDays className="size-3" /> {dayLabel(snapshot.date)}
              </Badge>
              {snapshot.outlet_name && (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  {snapshot.outlet_name}
                </Badge>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {allConfirmed ? "Stok hari ini siap dipantau" : "Siapkan stok sebelum mulai jualan"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {allConfirmed
                  ? "Penjualan mengurangi stok secara otomatis. Catat penerimaan, kerusakan, atau koreksi selama operasional."
                  : "Hitung stok fisik setiap menu, masukkan jumlah aktual, lalu konfirmasi sebagai titik awal hari ini."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <SummaryStat value={counts.available} label="Tersedia" tone="emerald" />
            <SummaryStat value={counts.low} label="Menipis" tone="amber" />
            <SummaryStat value={counts.outOrDisabled} label="Habis" tone="rose" />
          </div>
        </div>
        <div className={cn(
          "flex items-center gap-2 border-t px-5 py-3 text-xs sm:px-6",
          allConfirmed ? "bg-emerald-50/70 text-emerald-800" : "bg-amber-50/70 text-amber-900",
        )}>
          {allConfirmed ? <PackageCheck className="size-4 shrink-0" /> : <CircleDot className="size-4 shrink-0" />}
          <span className="font-medium">
            {allConfirmed ? "Stok awal sudah dikonfirmasi" : "Stok awal belum dikonfirmasi"}
          </span>
          <span className="hidden text-current/70 sm:inline">· {snapshot.items.length} menu tercatat</span>
        </div>
      </section>

      <StageTabs stage={stage} setStage={setStage} allConfirmed={allConfirmed} />

      {stage === "default" && <DefaultStage snapshot={snapshot} />}
      {stage === "opening" && (
        <OpeningStage
          snapshot={snapshot}
          allConfirmed={allConfirmed}
          onConfirmed={() => setStage("ops")}
        />
      )}
      {stage === "ops" && (
        <OperationalStage
          snapshot={snapshot}
          allConfirmed={allConfirmed}
          onOpenChecklist={() => setStage("opening")}
        />
      )}
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
  const tabs: Array<{ id: StageKey; label: string; hint: string; icon: typeof CircleDot }> = [
    {
      id: "opening",
      label: "Stok awal",
      hint: allConfirmed ? "Sudah dikonfirmasi" : "Isi jumlah aktual",
      icon: allConfirmed ? Check : CircleDot,
    },
    {
      id: "ops",
      label: "Pantau hari ini",
      hint: "Sisa, tambahan, dan koreksi",
      icon: PackageCheck,
    },
    {
      id: "default",
      label: "Pengaturan default",
      hint: "Patokan stok harian",
      icon: Settings2,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-1.5 rounded-xl bg-muted/60 p-1.5 sm:grid-cols-3">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setStage(t.id)}
            aria-current={stage === t.id ? "page" : undefined}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
              stage === t.id
                ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/10"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            <span className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              stage === t.id ? "bg-primary text-primary-foreground" : "bg-background",
            )}>
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{t.hint}</span>
            </span>
          </button>
        );
      })}
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
          loading={pending}
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
  onConfirmed,
}: {
  snapshot: StockSnapshot;
  allConfirmed: boolean;
  onConfirmed: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set());

  const sumOpening = snapshot.items.reduce((s, it) => s + it.daily_stock.opening_stock, 0);
  const zeroCount = snapshot.items.filter((it) => it.daily_stock.opening_stock === 0).length;
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    if (!needle) return snapshot.items;
    return snapshot.items.filter((item) =>
      `${item.menu_item.name} ${item.category_name ?? ""}`
        .toLocaleLowerCase("id-ID")
        .includes(needle),
    );
  }, [query, snapshot.items]);

  function handleSavingChange(itemId: string, saving: boolean) {
    setSavingIds((current) => {
      const next = new Set(current);
      if (saving) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  function handleConfirm() {
    start(async () => {
      try {
        const res = await confirmDailyStock(snapshot.outlet_id);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success("Stok hari ini dikonfirmasi");
          setConfirmOpen(false);
          router.refresh();
          onConfirmed();
        }
      } catch (err) {
        console.error("[stok] confirmDailyStock threw", err);
        toast.error("Gagal mengkonfirmasi stok. Coba lagi.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card className={cn(
        "gap-0 p-0",
        allConfirmed ? "bg-emerald-50/40 ring-emerald-200" : "bg-amber-50/40 ring-amber-200",
      )}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl",
              allConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800",
            )}>
              {allConfirmed ? <LockKeyhole className="size-5" /> : <CalendarDays className="size-5" />}
            </span>
            <div>
              <h3 className="font-semibold">
                {allConfirmed ? "Stok awal sudah dikunci" : "Hitung stok fisik sebelum outlet dibuka"}
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {allConfirmed
                  ? "Nilai ini menjadi titik awal laporan hari ini. Perubahan berikutnya dicatat di Pantau hari ini."
                  : "Masukkan total yang benar-benar tersedia sekarang. Sisa kemarin dan default hanya sebagai referensi."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-6 rounded-xl bg-background/80 px-4 py-3 ring-1 ring-foreground/10">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total awal</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">{sumOpening}</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Stok 0</div>
              <div className={cn("mt-0.5 text-xl font-semibold tabular-nums", zeroCount > 0 && "text-rose-600")}>
                {zeroCount}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="gap-0 p-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Daftar menu</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {snapshot.items.length} menu · perubahan tersimpan otomatis
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari menu atau kategori"
              aria-label="Cari menu atau kategori"
              className="h-9 pl-9"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="px-4 py-14 text-center text-sm text-muted-foreground">
            Menu yang dicari tidak ditemukan.
          </div>
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2 md:p-4">
            {filteredItems.map((item) => (
              <OpeningItemCard
                key={item.menu_item.id}
                item={item}
                onSavingChange={handleSavingChange}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {allConfirmed ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Lock className="size-3.5" /> Dikonfirmasi untuk {snapshot.outlet_name ?? "outlet ini"}
              </span>
            ) : zeroCount > 0 ? (
              <span><strong className="text-foreground">{zeroCount} menu bernilai 0.</strong> Pastikan memang habis sebelum konfirmasi.</span>
            ) : (
              <span>Periksa kembali semua jumlah sebelum dikunci.</span>
            )}
          </div>
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => setConfirmOpen(true)}
            disabled={pending || allConfirmed || snapshot.items.length === 0 || savingIds.size > 0}
          >
            {savingIds.size > 0 ? (
              <><Loader2 className="size-4 animate-spin" /> Menyimpan {savingIds.size} perubahan…</>
            ) : allConfirmed ? (
              <><Lock className="size-4" /> Stok awal sudah dikunci</>
            ) : (
              <><Check className="size-4" /> Konfirmasi stok awal</>
            )}
          </Button>
        </div>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi stok awal hari ini?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Setelah dikonfirmasi, stok awal tidak dapat diedit. Penerimaan atau koreksi berikutnya tetap bisa dicatat dari Pantau hari ini.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <ConfirmStat label="Menu" value={snapshot.items.length} />
              <ConfirmStat label="Total stok" value={sumOpening} />
              <ConfirmStat label="Stok 0" value={zeroCount} attention={zeroCount > 0} />
            </div>
            {zeroCount > 0 && (
              <div className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-800 ring-1 ring-rose-200">
                {zeroCount} menu akan dimulai dengan stok 0 dan tidak dapat dipesan.
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
                Periksa lagi
              </Button>
              <Button onClick={handleConfirm} disabled={pending || savingIds.size > 0} aria-busy={pending}>
                {pending ? (
                  <><Loader2 className="size-4 animate-spin" /> Mengonfirmasi…</>
                ) : (
                  <><Check className="size-4" /> Ya, konfirmasi stok</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OpeningItemCard({
  item,
  onSavingChange,
}: {
  item: StockSnapshot["items"][number];
  onSavingChange: (itemId: string, saving: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openingStr, setOpeningStr] = useState<string>(item.daily_stock.opening_stock.toString());
  const confirmed = !!item.daily_stock.confirmed_at;

  function persist(next: string) {
    const opening = Math.max(0, Math.floor(Number(next) || 0));
    start(async () => {
      onSavingChange(item.menu_item.id, true);
      try {
        const res = await updateOpeningStock(
          item.daily_stock.id,
          opening,
          item.effective_quota,
        );
        if (!res.ok) toast.error(res.error);
        else router.refresh();
      } catch (err) {
        console.error("[stok] updateOpeningStock threw", err);
        toast.error("Gagal menyimpan stok awal. Coba lagi.");
      } finally {
        onSavingChange(item.menu_item.id, false);
      }
    });
  }

  function applyReference(value: number | null) {
    if (value == null) return;
    const next = Math.max(0, value).toString();
    setOpeningStr(next);
    persist(next);
  }

  const opening = Math.max(0, Number(openingStr) || 0);
  const difference = item.yesterday_closing == null ? null : opening - item.yesterday_closing;

  return (
    <article className={cn(
      "rounded-xl border bg-card p-4 transition-colors",
      opening === 0 ? "border-rose-200" : "border-border",
    )}>
      <div className="flex items-start justify-between gap-3">
        <MenuCell item={item} />
        {confirmed ? (
          <Badge variant="outline" className="shrink-0 gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
            <Lock className="size-3" /> Terkunci
          </Badge>
        ) : opening === 0 ? (
          <Badge variant="outline" className="shrink-0 border-rose-200 bg-rose-50 text-rose-700">Stok 0</Badge>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ReferenceButton
          label="Sisa kemarin"
          value={item.yesterday_closing}
          onClick={() => applyReference(item.yesterday_closing)}
          disabled={confirmed || pending || item.yesterday_closing == null}
        />
        <ReferenceButton
          label="Default harian"
          value={item.effective_quota}
          onClick={() => applyReference(item.effective_quota)}
          disabled={confirmed || pending || item.effective_quota == null}
        />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t pt-4">
        <div>
          <Label className="text-xs text-muted-foreground">Stok awal aktual</Label>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {difference == null
              ? "Belum ada data kemarin"
              : difference === 0
              ? "Sama dengan sisa kemarin"
              : `${difference > 0 ? "+" : ""}${difference} dari sisa kemarin`}
          </p>
        </div>
        <Stepper
          value={openingStr}
          onChange={setOpeningStr}
          onCommit={persist}
          onDelta={(d) => {
            const next = Math.max(0, (Number(openingStr) || 0) + d).toString();
            setOpeningStr(next);
            persist(next);
          }}
          disabled={confirmed}
          loading={pending}
          prominent
        />
      </div>
    </article>
  );
}

function ConfirmStat({
  label,
  value,
  attention,
}: {
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <div className={cn("rounded-lg bg-muted/60 px-3 py-3 text-center", attention && "bg-rose-50 text-rose-800")}>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function ReferenceButton({
  label,
  value,
  onClick,
  disabled,
}: {
  label: string;
  value: number | null;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-muted/60 px-3 py-2 text-left transition-colors enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
      title={value == null ? `${label} belum tersedia` : `Gunakan ${label.toLocaleLowerCase("id-ID")}`}
    >
      <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="mt-0.5 block text-sm font-semibold tabular-nums">{value ?? "—"}</span>
    </button>
  );
}

// =============================================================================
// Stage 3 — Operational
// =============================================================================

function OperationalStage({
  snapshot,
  allConfirmed,
  onOpenChecklist,
}: {
  snapshot: StockSnapshot;
  allConfirmed: boolean;
  onOpenChecklist: () => void;
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
        <Card className="flex-row items-center justify-between gap-3 bg-amber-50/60 p-3 text-amber-900 ring-amber-200">
          <div className="flex items-center gap-2 text-xs">
            <CircleDot className="size-4 shrink-0" />
            Stok awal belum dikonfirmasi. Selesaikan hitung fisik agar laporan hari ini akurat.
          </div>
          <Button size="sm" variant="outline" onClick={onOpenChecklist} className="shrink-0 bg-background">
            Isi stok awal
          </Button>
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

function SummaryStat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "emerald" | "amber" | "rose";
}) {
  const colorClass = {
    emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    rose: "bg-rose-50 text-rose-800 ring-rose-200",
  }[tone];
  return (
    <div className={cn("rounded-xl px-3 py-3 text-center ring-1", colorClass)}>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</div>
    </div>
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
  loading,
  prominent,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  onDelta: (delta: number) => void;
  disabled?: boolean;
  loading?: boolean;
  prominent?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        size={prominent ? "icon-lg" : "icon"}
        variant="outline"
        className={prominent ? "size-9" : "h-7 w-7"}
        onClick={() => onDelta(-1)}
        disabled={disabled || loading}
        aria-label="Kurangi"
      >
        <Minus className="size-3" />
      </Button>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={(e) => onCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(
            "text-center px-1 tabular-nums",
            prominent ? "h-9 w-16 text-base font-semibold" : "h-7 w-14",
            loading && "opacity-0",
          )}
          aria-label="Jumlah stok"
          inputMode="numeric"
          disabled={disabled || loading}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <Button
        type="button"
        size={prominent ? "icon-lg" : "icon"}
        variant="outline"
        className={prominent ? "size-9" : "h-7 w-7"}
        onClick={() => onDelta(1)}
        disabled={disabled || loading}
        aria-label="Tambah"
      >
        <Plus className="size-3" />
      </Button>
    </div>
  );
}
