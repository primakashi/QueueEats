"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatIDR } from "@/lib/format";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { reorderMenuItems } from "@/app/(app)/admin/actions";
import { AvailabilityToggle } from "./availability-toggle";
import { DeleteMenuItemButton } from "./delete-button";

type GroupKey = string; // category id, or "__none__" for uncategorized
const UNCATEGORIZED: GroupKey = "__none__";

function groupKey(item: MenuItem): GroupKey {
  return item.category_id ?? UNCATEGORIZED;
}

function categoryIdFromGroup(g: GroupKey): string | null {
  return g === UNCATEGORIZED ? null : g;
}

export function MenuItemsBoard({
  items,
  categories,
}: {
  items: MenuItem[];
  categories: MenuCategory[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyGroup, setBusyGroup] = useState<GroupKey | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Local order maps server data to a per-group ordered list. Resets whenever
  // the items prop changes (after a revalidate).
  const [order, setOrder] = useState<Map<GroupKey, MenuItem[]>>(
    () => buildGroups(items),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(buildGroups(items));
  }, [items]);

  const groupOrder = useMemo<GroupKey[]>(() => {
    const keys: GroupKey[] = [];
    for (const c of categories) keys.push(c.id);
    keys.push(UNCATEGORIZED);
    return keys;
  }, [categories]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragOver(e: React.DragEvent, group: GroupKey, overId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    setOrder((current) => {
      const list = current.get(group);
      if (!list) return current;
      const from = list.findIndex((it) => it.id === draggingId);
      const to = list.findIndex((it) => it.id === overId);
      // Only allow reorder when dragging within the same group; cross-group
      // moves would also need a category change which is out of MVP scope.
      if (from < 0 || to < 0) return current;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      const map = new Map(current);
      map.set(group, next);
      return map;
    });
  }

  function handleDragEnd(group: GroupKey) {
    setDraggingId(null);
    persistGroup(group);
  }

  function persistGroup(group: GroupKey) {
    const list = order.get(group) ?? [];
    const baseline = buildGroups(items).get(group) ?? [];
    if (list.length === 0) return;
    if (list.map((i) => i.id).join(",") === baseline.map((i) => i.id).join(",")) return;
    setBusyGroup(group);
    start(async () => {
      try {
        const res = await reorderMenuItems(
          categoryIdFromGroup(group),
          list.map((i) => i.id),
        );
        if (!res.ok) {
          toast.error(res.error);
          setOrder(buildGroups(items));
          return;
        }
        router.refresh();
      } catch (err) {
        console.error("[menu-board] reorderMenuItems threw", err);
        toast.error("Gagal menyimpan urutan. Coba lagi.");
        setOrder(buildGroups(items));
      } finally {
        setBusyGroup(null);
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card className="p-12 text-center">
        <h2 className="text-lg font-medium mb-2">Belum ada item menu</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Tambahkan item pertama untuk memulai.
        </p>
        <Button render={<Link href="/admin/menu/new" />}>
          <Plus className="h-4 w-4 mr-2" /> Item baru
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {groupOrder.map((g) => {
        const list = order.get(g) ?? [];
        if (list.length === 0) return null;
        const categoryName =
          g === UNCATEGORIZED ? "Tanpa kategori" : categoryById.get(g)?.name ?? "—";
        return (
          <section key={g} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {categoryName}
              </h3>
              <span className="text-xs text-muted-foreground">
                {list.length} item · seret untuk urutkan
              </span>
            </div>
            <div className="space-y-2">
              {list.map((item) => (
                <MenuRow
                  key={item.id}
                  item={item}
                  isDragging={draggingId === item.id}
                  onDragStart={() => handleDragStart(item.id)}
                  onDragOver={(e) => handleDragOver(e, g, item.id)}
                  onDragEnd={() => handleDragEnd(g)}
                  disabled={pending}
                />
              ))}
            </div>
            {busyGroup === g && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                <Spinner /> Menyimpan urutan…
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MenuRow({
  item,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  disabled,
}: {
  item: MenuItem;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  disabled: boolean;
}) {
  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:border-foreground/20 ${
        isDragging ? "opacity-50 bg-muted/40" : ""
      }`}
    >
      <GripVertical
        className={`h-4 w-4 text-muted-foreground shrink-0 ${disabled ? "" : "cursor-grab"}`}
      />
      <div className="relative h-12 w-12 rounded-md overflow-hidden bg-muted shrink-0">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{item.name}</div>
        {item.description && (
          <div className="text-xs text-muted-foreground truncate">{item.description}</div>
        )}
      </div>
      <Badge variant="secondary" className="hidden sm:inline-flex tabular-nums">
        {formatIDR(item.price)}
      </Badge>
      <AvailabilityToggle id={item.id} available={item.is_available} />
      <Button
        size="sm"
        variant="outline"
        render={<Link href={`/admin/menu/${item.id}/edit`} />}
      >
        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Ubah
      </Button>
      <DeleteMenuItemButton id={item.id} name={item.name} />
    </div>
  );
}

function buildGroups(items: MenuItem[]): Map<GroupKey, MenuItem[]> {
  const map = new Map<GroupKey, MenuItem[]>();
  for (const it of items) {
    const k = groupKey(it);
    let list = map.get(k);
    if (!list) {
      list = [];
      map.set(k, list);
    }
    list.push(it);
  }
  // Caller fetched in sort_order ASC; preserve.
  return map;
}
