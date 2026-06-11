"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatIDR } from "@/lib/format";
import type { MenuItem, OrderItem } from "@/lib/types";
import { addOrderItem, removeOrderItem, updateOrderItemQty } from "./edit-actions";

export function EditableOrderItems({
  orderId,
  items,
  total,
  subtotal,
  taxAmount,
  serviceAmount,
  menuItems,
}: {
  orderId: string;
  items: OrderItem[];
  total: number;
  subtotal: number;
  taxAmount: number;
  serviceAmount: number;
  menuItems: MenuItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [search, setSearch] = useState("");

  function setQty(itemId: string, qty: number) {
    setBusyItemId(itemId);
    start(async () => {
      const res = await updateOrderItemQty(orderId, itemId, qty);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
      setBusyItemId(null);
    });
  }

  function remove(itemId: string) {
    setBusyItemId(itemId);
    start(async () => {
      const res = await removeOrderItem(orderId, itemId);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
      setBusyItemId(null);
    });
  }

  function addItem(menuItemId: string) {
    start(async () => {
      const res = await addOrderItem(orderId, menuItemId, 1);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Item ditambahkan");
      router.refresh();
      setAddSheetOpen(false);
    });
  }

  const filtered = menuItems.filter(
    (m) =>
      m.is_available &&
      (!search.trim() ||
        m.name.toLowerCase().includes(search.trim().toLowerCase())),
  );

  return (
    <>
      <div className="py-4 space-y-2">
        {items.map((i) => (
          <div key={i.id} className="flex justify-between gap-3 items-center">
            <div className="min-w-0 flex-1">
              <div>
                <span className="font-semibold tabular-nums">{i.quantity}×</span>{" "}
                {i.name_snapshot}
              </div>
              {i.notes && (
                <div className="text-xs text-muted-foreground italic">{i.notes}</div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 border rounded-md">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={pending && busyItemId === i.id}
                  onClick={() => setQty(i.id, i.quantity - 1)}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <div className="w-7 text-center text-sm tabular-nums font-semibold">
                  {busyItemId === i.id && pending ? (
                    <Spinner size="xs" />
                  ) : (
                    i.quantity
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={pending && busyItemId === i.id}
                  onClick={() => setQty(i.id, i.quantity + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="tabular-nums text-sm w-20 text-right">
                {formatIDR(i.price_snapshot * i.quantity)}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                disabled={pending && busyItemId === i.id}
                onClick={() => remove(i.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mb-4">
        <Sheet open={addSheetOpen} onOpenChange={setAddSheetOpen}>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm" className="w-full" disabled={pending} />
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah item
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
            <SheetHeader className="px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <SheetTitle>Tambah item ke pesanan</SheetTitle>
              </div>
            </SheetHeader>
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Cari item menu…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => setSearch("")}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={pending}
                  onClick={() => addItem(m.id)}
                  className="w-full flex justify-between items-center px-3 py-2.5 rounded-md border hover:bg-muted transition text-left text-sm"
                >
                  <span>{m.name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatIDR(m.price)}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Tidak ada item ditemukan
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <Separator />
      <div className="space-y-1.5 pt-4">
        {(taxAmount > 0 || serviceAmount > 0) && (
          <>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatIDR(subtotal)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Pajak</span>
                <span className="tabular-nums">{formatIDR(taxAmount)}</span>
              </div>
            )}
            {serviceAmount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Biaya layanan</span>
                <span className="tabular-nums">{formatIDR(serviceAmount)}</span>
              </div>
            )}
            <Separator />
          </>
        )}
        <div className="flex justify-between items-center">
          <span className="font-medium">Total</span>
          <span className="text-2xl font-semibold tabular-nums">{formatIDR(total)}</span>
        </div>
      </div>
    </>
  );
}
