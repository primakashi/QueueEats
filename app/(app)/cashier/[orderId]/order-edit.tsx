"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatIDR } from "@/lib/format";
import type {
  Discount,
  DiscountScope,
  DiscountValueType,
  MenuItem,
  OrderDiscount,
  OrderItem,
} from "@/lib/types";
import {
  addOrderItem,
  applyDiscount,
  removeOrderDiscount,
  removeOrderItem,
  updateOrderItemQty,
} from "./edit-actions";

export function EditableOrderItems({
  orderId,
  items,
  total,
  subtotal,
  taxAmount,
  serviceAmount,
  discountAmount,
  menuItems,
  appliedDiscounts,
  discountCatalog,
}: {
  orderId: string;
  items: OrderItem[];
  total: number;
  subtotal: number;
  taxAmount: number;
  serviceAmount: number;
  discountAmount: number;
  menuItems: MenuItem[];
  appliedDiscounts: OrderDiscount[];
  discountCatalog: Discount[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [busyDiscountId, setBusyDiscountId] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [discountSheetOpen, setDiscountSheetOpen] = useState(false);
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

  function removeDiscount(rowId: string) {
    setBusyDiscountId(rowId);
    start(async () => {
      const res = await removeOrderDiscount(orderId, rowId);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
      setBusyDiscountId(null);
    });
  }

  function applyDiscountFromCatalog(d: Discount, orderItemId: string | null) {
    start(async () => {
      const res = await applyDiscount({
        orderId,
        discountId: d.id,
        scope: d.scope,
        name: d.name,
        valueType: d.value_type,
        value: Number(d.value),
        orderItemId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Diskon "${d.name}" diterapkan`);
      router.refresh();
      setDiscountSheetOpen(false);
    });
  }

  function applyManualDiscount(form: {
    scope: DiscountScope;
    name: string;
    valueType: DiscountValueType;
    value: number;
    reason: string;
    orderItemId: string | null;
  }) {
    start(async () => {
      const res = await applyDiscount({
        orderId,
        scope: form.scope,
        name: form.name,
        valueType: form.valueType,
        value: form.value,
        reason: form.reason,
        orderItemId: form.orderItemId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Diskon diterapkan");
      router.refresh();
      setDiscountSheetOpen(false);
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
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
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

        <Sheet open={discountSheetOpen} onOpenChange={setDiscountSheetOpen}>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm" className="w-full" disabled={pending} />
            }
          >
            <Tag className="h-3.5 w-3.5 mr-1.5" /> Tambah diskon
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle>Tambah diskon</SheetTitle>
            </SheetHeader>
            <DiscountPicker
              orderItems={items}
              catalog={discountCatalog}
              pending={pending}
              onPickCatalog={applyDiscountFromCatalog}
              onManual={applyManualDiscount}
            />
          </SheetContent>
        </Sheet>
      </div>

      {appliedDiscounts.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {appliedDiscounts.map((d) => {
            const itemName = d.order_item_id
              ? items.find((i) => i.id === d.order_item_id)?.name_snapshot
              : null;
            return (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Tag className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate">
                      {d.name_snapshot}
                      <span className="text-muted-foreground ml-1">
                        ({d.value_type === "percent" ? `${d.value_snapshot}%` : formatIDR(d.value_snapshot)}
                        {itemName ? ` · ${itemName}` : ""})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="tabular-nums text-emerald-700 font-medium">
                    −{formatIDR(d.amount)}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={pending && busyDiscountId === d.id}
                    onClick={() => removeDiscount(d.id)}
                    aria-label="Hapus diskon"
                  >
                    {busyDiscountId === d.id && pending ? (
                      <Spinner size="xs" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Separator />
      <div className="space-y-1.5 pt-4">
        {(taxAmount > 0 || serviceAmount > 0 || discountAmount > 0) && (
          <>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatIDR(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-700">
                <span>Diskon</span>
                <span className="tabular-nums">−{formatIDR(discountAmount)}</span>
              </div>
            )}
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

function DiscountPicker({
  orderItems,
  catalog,
  pending,
  onPickCatalog,
  onManual,
}: {
  orderItems: OrderItem[];
  catalog: Discount[];
  pending: boolean;
  onPickCatalog: (d: Discount, orderItemId: string | null) => void;
  onManual: (form: {
    scope: DiscountScope;
    name: string;
    valueType: DiscountValueType;
    value: number;
    reason: string;
    orderItemId: string | null;
  }) => void;
}) {
  const [mode, setMode] = useState<"catalog" | "manual">(
    catalog.length > 0 ? "catalog" : "manual",
  );
  const [pickItemFor, setPickItemFor] = useState<Discount | null>(null);
  // Separate item-id state for the catalog "pick item" flow and the manual form
  // so cancelling one doesn't leak a stale selection into the other.
  const [catalogItemId, setCatalogItemId] = useState<string>("");

  // Manual form
  const [scope, setScope] = useState<DiscountScope>("transaction");
  const [name, setName] = useState("");
  const [valueType, setValueType] = useState<DiscountValueType>("percent");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [manualItemId, setManualItemId] = useState<string>("");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex gap-1 p-3 border-b">
        <button
          type="button"
          onClick={() => setMode("catalog")}
          className={`flex-1 h-8 rounded-md text-sm font-medium ${
            mode === "catalog"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          }`}
        >
          Dari katalog
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex-1 h-8 rounded-md text-sm font-medium ${
            mode === "manual"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          }`}
        >
          Manual
        </button>
      </div>

      {mode === "catalog" && (
        <div className="p-4 space-y-2">
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Belum ada diskon yang dikonfigurasi. Atur di menu Diskon, atau gunakan tab Manual.
            </p>
          ) : (
            catalog.map((d) => (
              <div
                key={d.id}
                className="border rounded-md p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.scope === "menu_item"
                      ? "Per item"
                      : d.scope === "transaction"
                        ? "Per transaksi"
                        : "Promo harian"}{" "}
                    ·{" "}
                    {d.value_type === "percent"
                      ? `${d.value}%`
                      : formatIDR(d.value)}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (d.scope === "menu_item") {
                      if (d.menu_item_id) {
                        const oi = orderItems.find(
                          (i) => i.menu_item_id === d.menu_item_id,
                        );
                        if (!oi) {
                          toast.error("Item tidak ada di pesanan");
                          return;
                        }
                        onPickCatalog(d, oi.id);
                      } else {
                        setPickItemFor(d);
                      }
                    } else {
                      onPickCatalog(d, null);
                    }
                  }}
                >
                  Terapkan
                </Button>
              </div>
            ))
          )}

          {pickItemFor && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/30">
              <Label>Pilih item untuk &ldquo;{pickItemFor.name}&rdquo;</Label>
              <Select
                value={catalogItemId}
                onValueChange={(v) => { if (v) setCatalogItemId(v); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih item…" />
                </SelectTrigger>
                <SelectContent>
                  {orderItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.quantity}× {i.name_snapshot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending || !catalogItemId}
                  onClick={() => onPickCatalog(pickItemFor, catalogItemId)}
                >
                  Terapkan
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPickItemFor(null);
                    setCatalogItemId("");
                  }}
                >
                  Batal
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "manual" && (
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Tipe diskon</Label>
            <Select
              value={scope}
              onValueChange={(v) => v && setScope(v as DiscountScope)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transaction">Per transaksi</SelectItem>
                <SelectItem value="menu_item">Per item</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "menu_item" && (
            <div className="space-y-1.5">
              <Label>Item</Label>
              <Select
                value={manualItemId}
                onValueChange={(v) => v && setManualItemId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih item…" />
                </SelectTrigger>
                <SelectContent>
                  {orderItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.quantity}× {i.name_snapshot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Nama / alasan tampil di struk</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Diskon manajer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tipe nilai</Label>
              <Select
                value={valueType}
                onValueChange={(v) => v && setValueType(v as DiscountValueType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Persen (%)</SelectItem>
                  <SelectItem value="amount">Nominal (Rp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nilai</Label>
              <Input
                type="number"
                min="0"
                step={valueType === "percent" ? "0.1" : "1"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={valueType === "percent" ? "10" : "5000"}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Catatan internal (opsional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="mis. Approved by manajer Andi"
            />
          </div>

          <Button
            className="w-full"
            disabled={pending}
            onClick={() => {
              if (!name.trim()) {
                toast.error("Nama diskon wajib diisi");
                return;
              }
              const v = Number(value);
              if (!Number.isFinite(v) || v <= 0) {
                toast.error("Nilai harus angka > 0");
                return;
              }
              if (scope === "menu_item" && !manualItemId) {
                toast.error("Pilih item terlebih dahulu");
                return;
              }
              onManual({
                scope,
                name: name.trim(),
                valueType,
                value: v,
                reason: reason.trim(),
                orderItemId: scope === "menu_item" ? manualItemId : null,
              });
            }}
          >
            {pending ? <Spinner className="mr-2" /> : <Tag className="h-4 w-4 mr-2" />}
            Terapkan diskon
          </Button>
        </div>
      )}
    </div>
  );
}
