"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, CircleDollarSign, Eye, EyeOff, GripVertical, ImageIcon, Layers3, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { reorderMenuItems } from "@/app/(app)/admin/actions";
import { AvailabilityToggle } from "./availability-toggle";
import { DeleteMenuItemButton } from "./delete-button";

type GroupKey = string;
type AvailabilityFilter = "all" | "available" | "hidden";

const UNCATEGORIZED: GroupKey = "__none__";
const ALL_CATEGORIES = "__all__";

function groupKey(item: MenuItem): GroupKey {
  return item.category_id ?? UNCATEGORIZED;
}

function categoryIdFromGroup(group: GroupKey): string | null {
  return group === UNCATEGORIZED ? null : group;
}

export function MenuBoardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-20 rounded-2xl" />
      {[0, 1].map((group) => (
        <div key={group} className="overflow-hidden rounded-2xl border">
          <Skeleton className="h-16 rounded-none" />
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex items-center gap-3 border-t p-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-8 w-36" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function MenuItemsBoard({ items, categories }: { items: MenuItem[]; categories: MenuCategory[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyGroup, setBusyGroup] = useState<GroupKey | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [order, setOrder] = useState<Map<GroupKey, MenuItem[]>>(() => buildGroups(items));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(buildGroups(items));
  }, [items]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const groupOrder = useMemo<GroupKey[]>(() => [...categories.map((category) => category.id), UNCATEGORIZED], [categories]);
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const filtersActive = Boolean(normalizedQuery) || availability !== "all" || categoryFilter !== ALL_CATEGORIES;
  const availableCount = items.filter((item) => item.is_available).length;
  const hiddenCount = items.length - availableCount;
  const averagePrice = items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.price), 0) / items.length) : 0;

  const visibleByGroup = useMemo(() => {
    const result = new Map<GroupKey, MenuItem[]>();
    for (const group of groupOrder) {
      if (categoryFilter !== ALL_CATEGORIES && categoryFilter !== group) continue;
      const visible = (order.get(group) ?? []).filter((item) => {
        const matchesQuery = !normalizedQuery || item.name.toLocaleLowerCase("id-ID").includes(normalizedQuery) || (item.description ?? "").toLocaleLowerCase("id-ID").includes(normalizedQuery);
        const matchesAvailability = availability === "all" || (availability === "available" ? item.is_available : !item.is_available);
        return matchesQuery && matchesAvailability;
      });
      if (visible.length) result.set(group, visible);
    }
    return result;
  }, [availability, categoryFilter, groupOrder, normalizedQuery, order]);

  const visibleCount = [...visibleByGroup.values()].reduce((sum, group) => sum + group.length, 0);

  function clearFilters() {
    setQuery("");
    setAvailability("all");
    setCategoryFilter(ALL_CATEGORIES);
  }

  function handleDragOver(event: React.DragEvent, group: GroupKey, overId: string) {
    event.preventDefault();
    if (!draggingId || draggingId === overId || filtersActive) return;
    setOrder((current) => {
      const list = current.get(group);
      if (!list) return current;
      const from = list.findIndex((item) => item.id === draggingId);
      const to = list.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0) return current;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      const map = new Map(current);
      map.set(group, next);
      return map;
    });
  }

  function moveItem(group: GroupKey, id: string, direction: -1 | 1) {
    const list = order.get(group);
    if (!list || filtersActive) return;
    const from = list.findIndex((item) => item.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder((current) => new Map(current).set(group, next));
    persistList(group, next);
  }

  function persistList(group: GroupKey, list: MenuItem[]) {
    const baseline = buildGroups(items).get(group) ?? [];
    if (!list.length || list.map((item) => item.id).join(",") === baseline.map((item) => item.id).join(",")) return;
    setBusyGroup(group);
    start(async () => {
      try {
        const result = await reorderMenuItems(categoryIdFromGroup(group), list.map((item) => item.id));
        if (!result.ok) {
          toast.error(result.error);
          setOrder(buildGroups(items));
          return;
        }
        router.refresh();
      } catch (error) {
        console.error("[menu-board] reorderMenuItems threw", error);
        toast.error("Gagal menyimpan urutan. Coba lagi.");
        setOrder(buildGroups(items));
      } finally {
        setBusyGroup(null);
      }
    });
  }

  if (!items.length) {
    return (
      <Card className="border-dashed p-10 text-center sm:p-16">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Layers3 className="h-6 w-6" /></div>
        <h2 className="text-xl font-semibold">Katalogmu masih kosong</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Tambahkan menu pertama agar tim kasir dan pelanggan bisa mulai memesan.</p>
        <Button className="mt-5" render={<Link href="/admin/menu/new" />}><Plus className="h-4 w-4" /> Tambah item pertama</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Layers3 />} label="Total menu" value={String(items.length)} helper={`${categories.length} kategori`} />
        <StatCard icon={<Eye />} label="Tersedia" value={String(availableCount)} helper="Siap dipesan" tone="success" />
        <StatCard icon={<EyeOff />} label="Disembunyikan" value={String(hiddenCount)} helper={hiddenCount ? "Perlu ditinjau" : "Semua aktif"} tone={hiddenCount ? "warning" : "neutral"} />
        <StatCard icon={<CircleDollarSign />} label="Harga rata-rata" value={formatIDR(averagePrice)} helper="Seluruh item" />
      </div>

      <div className="sticky top-3 z-10 rounded-2xl border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau deskripsi menu…" aria-label="Cari menu" className="h-11 bg-muted/35 pl-9 pr-9" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Hapus pencarian" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:pb-0" aria-label="Filter ketersediaan">
            {([["all", "Semua", items.length], ["available", "Tersedia", availableCount], ["hidden", "Disembunyikan", hiddenCount]] as const).map(([value, label, count]) => (
              <button type="button" key={value} onClick={() => setAvailability(value)} className={cn("h-9 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors", availability === value ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted")}>
                {label} <span className="ml-1 opacity-65">{count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto border-t pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Kategori:</span>
          <CategoryChip active={categoryFilter === ALL_CATEGORIES} onClick={() => setCategoryFilter(ALL_CATEGORIES)} label="Semua" />
          {categories.map((category) => <CategoryChip key={category.id} active={categoryFilter === category.id} onClick={() => setCategoryFilter(category.id)} label={category.name} />)}
          {(order.get(UNCATEGORIZED)?.length ?? 0) > 0 && <CategoryChip active={categoryFilter === UNCATEGORIZED} onClick={() => setCategoryFilter(UNCATEGORIZED)} label="Tanpa kategori" />}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">Menampilkan <span className="font-semibold text-foreground">{visibleCount}</span> dari {items.length} item</p>
        <div className="flex items-center gap-3">
          {filtersActive && <span className="hidden text-xs text-muted-foreground sm:inline">Hapus filter untuk mengubah urutan</span>}
          <Button variant="ghost" size="sm" render={<Link href="#kategori" />}>Kelola kategori</Button>
        </div>
      </div>

      {visibleCount === 0 ? (
        <Card className="border-dashed py-14 text-center">
          <Search className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
          <h3 className="font-semibold">Menu tidak ditemukan</h3>
          <p className="mt-1 text-sm text-muted-foreground">Coba kata kunci atau filter yang berbeda.</p>
          <Button variant="outline" className="mt-4" onClick={clearFilters}>Hapus semua filter</Button>
        </Card>
      ) : (
        <div className="space-y-5">
          {groupOrder.map((group) => {
            const list = visibleByGroup.get(group);
            if (!list?.length) return null;
            const fullList = order.get(group) ?? [];
            const categoryName = group === UNCATEGORIZED ? "Tanpa kategori" : categoryById.get(group)?.name ?? "Kategori";
            const categoryAvailable = fullList.filter((item) => item.is_available).length;
            const saving = busyGroup === group;
            return (
              <section key={group} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="flex flex-col gap-2 border-b bg-muted/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <div className="flex items-center gap-2"><h2 className="text-base font-semibold tracking-tight">{categoryName}</h2><Badge variant="secondary" className="rounded-full">{fullList.length}</Badge></div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{categoryAvailable} tersedia · {fullList.length - categoryAvailable} disembunyikan</p>
                  </div>
                  <div className="text-xs text-muted-foreground">{saving ? <span className="inline-flex items-center gap-1.5 font-medium text-foreground"><Spinner /> Menyimpan urutan…</span> : filtersActive ? "Urutan dikunci saat filter aktif" : "Seret item atau gunakan tombol panah"}</div>
                </div>
                <div className={cn("divide-y transition-opacity", saving && "pointer-events-none opacity-60")}>
                  {list.map((item) => {
                    const originalIndex = fullList.findIndex((candidate) => candidate.id === item.id);
                    return <MenuRow key={item.id} item={item} isDragging={draggingId === item.id} reorderDisabled={pending || filtersActive} onDragStart={() => setDraggingId(item.id)} onDragOver={(event) => handleDragOver(event, group, item.id)} onDragEnd={() => { setDraggingId(null); persistList(group, order.get(group) ?? []); }} onMoveUp={originalIndex > 0 ? () => moveItem(group, item.id, -1) : undefined} onMoveDown={originalIndex < fullList.length - 1 ? () => moveItem(group, item.id, 1) : undefined} />;
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, helper, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; helper: string; tone?: "neutral" | "success" | "warning" }) {
  return (
    <Card className="gap-0 rounded-2xl border-border/70 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 whitespace-nowrap text-lg font-semibold tracking-tight sm:text-2xl">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl [&_svg]:h-4 [&_svg]:w-4", tone === "success" && "bg-emerald-500/10 text-emerald-700", tone === "warning" && "bg-amber-500/10 text-amber-700", tone === "neutral" && "bg-primary/10 text-primary")}>{icon}</div>
      </div>
    </Card>
  );
}

function CategoryChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className={cn("h-7 shrink-0 rounded-full px-3 text-xs font-medium transition-colors", active ? "bg-primary/12 text-primary ring-1 ring-primary/20" : "bg-muted text-muted-foreground hover:text-foreground")}>{label}</button>;
}

function MenuRow({ item, isDragging, reorderDisabled, onDragStart, onDragOver, onDragEnd, onMoveUp, onMoveDown }: { item: MenuItem; isDragging: boolean; reorderDisabled: boolean; onDragStart: () => void; onDragOver: (event: React.DragEvent) => void; onDragEnd: () => void; onMoveUp?: () => void; onMoveDown?: () => void }) {
  return (
    <div draggable={!reorderDisabled} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} className={cn("group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/25 sm:px-5", isDragging && "bg-muted opacity-55")}>
      <GripVertical className={cn("hidden h-4 w-4 shrink-0 text-muted-foreground/55 sm:block", !reorderDisabled && "cursor-grab group-hover:text-foreground")} aria-hidden="true" />
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-16 sm:w-16">
        {item.image_url ? <Image src={item.image_url} alt="" fill sizes="64px" className="object-cover transition-transform duration-300 group-hover:scale-105" /> : <div className="absolute inset-0 grid place-items-center"><ImageIcon className="h-5 w-5 text-muted-foreground/50" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2"><h3 className="truncate text-sm font-semibold sm:text-base">{item.name}</h3>{!item.is_available && <span className="hidden rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 sm:inline">Tidak tampil</span>}</div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.description || "Belum ada deskripsi"}</p>
        <p className="mt-1 text-sm font-semibold tabular-nums sm:hidden">{formatIDR(item.price)}</p>
      </div>
      <div className="hidden min-w-24 text-right sm:block"><p className="text-sm font-semibold tabular-nums">{formatIDR(item.price)}</p><p className="text-[11px] text-muted-foreground">Harga jual</p></div>
      <div className="flex shrink-0 items-center gap-1.5">
        <AvailabilityToggle id={item.id} available={item.is_available} />
        <Button size="icon-sm" variant="outline" aria-label={`Ubah ${item.name}`} render={<Link href={`/admin/menu/${item.id}/edit`} />}><Pencil className="h-3.5 w-3.5" /></Button>
        <DeleteMenuItemButton id={item.id} name={item.name} />
        <div className="hidden items-center sm:flex"><Button type="button" size="icon-xs" variant="ghost" aria-label={`Pindahkan ${item.name} ke atas`} disabled={reorderDisabled || !onMoveUp} onClick={onMoveUp}><ChevronUp /></Button><Button type="button" size="icon-xs" variant="ghost" aria-label={`Pindahkan ${item.name} ke bawah`} disabled={reorderDisabled || !onMoveDown} onClick={onMoveDown}><ChevronDown /></Button></div>
      </div>
    </div>
  );
}

function buildGroups(items: MenuItem[]): Map<GroupKey, MenuItem[]> {
  const map = new Map<GroupKey, MenuItem[]>();
  for (const item of items) {
    const key = groupKey(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}
