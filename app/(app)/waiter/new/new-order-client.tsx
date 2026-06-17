"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailyStock, MenuCategory, MenuItem, OrderChannel, OrderChannelConfig, Outlet } from "@/lib/types";
import { startRouteProgress } from "@/components/route-progress";
import { FullScreenLoading } from "@/components/full-screen-loading";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FLOOR_SECTIONS,
  FLOOR_TABLES,
  findFloorTable,
} from "@/lib/floor-plan";
import { createOrder } from "../actions";

const TABLE_NONE = "__none__";

type CartLine = {
  itemId: string;
  quantity: number;
  notes: string;
};

export function NewOrderClient({
  items,
  categories,
  outlets,
  channels,
  dailyStocks,
}: {
  items: MenuItem[];
  categories: MenuCategory[];
  outlets: Pick<Outlet, "id" | "name" | "is_temporary">[];
  channels: OrderChannelConfig[];
  dailyStocks: DailyStock[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"custom" | "name">("custom");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [serviceType, setServiceType] = useState<"dine_in" | "takeaway">(
    "dine_in",
  );
  const [selectedTableId, setSelectedTableId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [outletId, setOutletId] = useState<string>(outlets[0]?.id ?? "");
  const [orderChannel, setOrderChannel] = useState<OrderChannel>(() => channels[0]?.id ?? "direct");

  // Wrap the setter so callers don't need to remember to reset the table when
  // they toggle dine-in/takeaway. Previously this was a useEffect, but the
  // React 19 lint rule (and best practice) prefers handler-driven resets.
  function handleServiceTypeChange(t: "dine_in" | "takeaway") {
    setServiceType(t);
    setSelectedTableId("");
  }

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Stock lookup keyed by `${outletId}|${menuItemId}`. Items without a row are
  // untracked (unlimited); items with a row are gated by current_stock + is_active.
  const stockMap = useMemo(() => {
    const m = new Map<string, { current: number; active: boolean }>();
    for (const s of dailyStocks) {
      m.set(`${s.outlet_id}|${s.menu_item_id}`, { current: s.current_stock, active: s.is_active });
    }
    return m;
  }, [dailyStocks]);

  function stockFor(itemId: string): { current: number; active: boolean } | null {
    if (!outletId) return null;
    return stockMap.get(`${outletId}|${itemId}`) ?? null;
  }
  const filteredItems = useMemo(() => {
    let list = items;
    if (selectedCategory === "uncategorized") {
      list = list.filter((i) => !i.category_id);
    } else if (selectedCategory !== "all") {
      list = list.filter((i) => i.category_id === selectedCategory);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description ?? "").toLowerCase().includes(q),
      );
    }
    if (sortMode === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [items, selectedCategory, search, sortMode]);

  const totalItems = cart.reduce((s, l) => s + l.quantity, 0);
  const total = cart.reduce((s, l) => {
    const it = itemMap.get(l.itemId);
    return s + (it ? it.price * l.quantity : 0);
  }, 0);

  function addToCart(itemId: string) {
    const stock = stockFor(itemId);
    if (stock && !stock.active) {
      toast.error("Item dinonaktifkan untuk hari ini");
      return;
    }
    if (stock && stock.current <= 0) {
      toast.error("Stok habis untuk hari ini");
      return;
    }
    setCart((c) => {
      const existing = c.find((l) => l.itemId === itemId);
      const currentQty = existing?.quantity ?? 0;
      if (stock && currentQty + 1 > stock.current) {
        toast.error(`Sisa stok hanya ${stock.current}`);
        return c;
      }
      if (existing) {
        return c.map((l) =>
          l.itemId === itemId ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...c, { itemId, quantity: 1, notes: "" }];
    });
  }

  function setQty(itemId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((c) => c.filter((l) => l.itemId !== itemId));
    } else {
      setCart((c) =>
        c.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)),
      );
    }
  }

  function setLineNotes(itemId: string, notes: string) {
    setCart((c) => c.map((l) => (l.itemId === itemId ? { ...l, notes } : l)));
  }

  function removeLine(itemId: string) {
    setCart((c) => c.filter((l) => l.itemId !== itemId));
  }

  function submit() {
    if (cart.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }
    if (outlets.length > 0 && !outletId) {
      toast.error("Pilih outlet terlebih dahulu.");
      return;
    }
    start(async () => {
      const table =
        serviceType === "dine_in" ? selectedTableId.trim() : "";
      const res = await createOrder({
        service_type: serviceType,
        table_number: table.length > 0 ? table : null,
        customer_name: customerName.trim() || undefined,
        notes: orderNotes.trim() || undefined,
        outlet_id: outletId || null,
        order_channel: orderChannel,
        items: cart.map((l) => ({
          menu_item_id: l.itemId,
          quantity: l.quantity,
          notes: l.notes.trim() || undefined,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Pesanan ${res.order.order_number} dikirim ke dapur`);
      startRouteProgress();
      router.push(`/waiter/confirmation/${res.order.id}`);
    });
  }

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_380px]">
      {pending && (
        <FullScreenLoading title="Mengirim pesanan ke dapur…" />
      )}
      <div className="space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              placeholder="Cari menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari menu"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                aria-label="Bersihkan pencarian"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex gap-1 shrink-0 rounded-md border p-0.5">
            <button
              type="button"
              onClick={() => setSortMode("custom")}
              className={cn(
                "px-3 h-9 rounded-sm text-xs font-medium transition",
                sortMode === "custom"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Urutan menu
            </button>
            <button
              type="button"
              onClick={() => setSortMode("name")}
              className={cn(
                "px-3 h-9 rounded-sm text-xs font-medium transition",
                sortMode === "name"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              A–Z
            </button>
          </div>
        </div>

        <CategoryTabs
          categories={categories}
          value={selectedCategory}
          onChange={setSelectedCategory}
        />

        {filteredItems.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            {search
              ? `Tidak ada item cocok dengan "${search}".`
              : "Tidak ada item di kategori ini."}
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((it) => {
              const qty =
                cart.find((l) => l.itemId === it.id)?.quantity ?? 0;
              const stock = stockFor(it.id);
              const disabled = !!stock && (!stock.active || stock.current <= 0);
              const lowStock = !!stock && stock.active && stock.current > 0 && stock.current <= 5;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => addToCart(it.id)}
                  disabled={disabled}
                  aria-disabled={disabled}
                  className={cn(
                    "group text-left rounded-lg border bg-card hover:border-primary hover:shadow-sm active:scale-[0.98] transition overflow-hidden touch-manipulation",
                    qty > 0 && "ring-2 ring-primary border-transparent",
                    disabled && "opacity-50 cursor-not-allowed hover:border-border hover:shadow-none active:scale-100",
                  )}
                >
                  <div className="relative aspect-square bg-muted">
                    {it.image_url ? (
                      <Image
                        src={it.image_url}
                        alt={it.name}
                        fill
                        sizes="(max-width:640px) 50vw, 25vw"
                        className={cn("object-cover", disabled && "grayscale")}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                        Tanpa gambar
                      </div>
                    )}
                    {qty > 0 && (
                      <div className="absolute top-2 right-2 h-7 min-w-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold px-2">
                        {qty}
                      </div>
                    )}
                    {disabled && (
                      <div className="absolute top-2 left-2 inline-flex items-center rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                        {!stock?.active ? "Nonaktif" : "Habis"}
                      </div>
                    )}
                    {!disabled && lowStock && (
                      <div className="absolute top-2 left-2 inline-flex items-center rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                        Sisa {stock!.current}
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="font-medium text-sm line-clamp-2">
                      {it.name}
                    </div>
                    <div className="text-sm tabular-nums font-semibold">
                      {formatIDR(it.price)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop / tablet inline cart */}
      <div className="hidden md:block">
        <div className="sticky top-6">
          <CartPanel
            cart={cart}
            itemMap={itemMap}
            total={total}
            serviceType={serviceType}
            setServiceType={handleServiceTypeChange}
            selectedTableId={selectedTableId}
            setSelectedTableId={setSelectedTableId}
            customerName={customerName}
            setCustomerName={setCustomerName}
            orderNotes={orderNotes}
            setOrderNotes={setOrderNotes}
            setQty={setQty}
            setLineNotes={setLineNotes}
            removeLine={removeLine}
            onSubmit={submit}
            pending={pending}
            outlets={outlets}
            outletId={outletId}
            setOutletId={setOutletId}
            orderChannel={orderChannel}
            setOrderChannel={setOrderChannel}
            channels={channels}
          />
        </div>
      </div>

      {/* Mobile floating cart button + sheet */}
      <div className="md:hidden fixed bottom-4 right-4 z-30">
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger
            render={
              <Button
                size="lg"
                className="shadow-lg rounded-full h-14 pr-6"
              />
            }
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            {totalItems > 0 ? (
              <>
                {totalItems} · {formatIDR(total)}
              </>
            ) : (
              "Keranjang"
            )}
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[92vh] p-0 flex flex-col">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle>
                Keranjang {cartCount > 0 && `(${cartCount})`}
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <CartPanel
                embedded
                cart={cart}
                itemMap={itemMap}
                total={total}
                serviceType={serviceType}
                setServiceType={handleServiceTypeChange}
                selectedTableId={selectedTableId}
                setSelectedTableId={setSelectedTableId}
                customerName={customerName}
                setCustomerName={setCustomerName}
                orderNotes={orderNotes}
                setOrderNotes={setOrderNotes}
                setQty={setQty}
                setLineNotes={setLineNotes}
                removeLine={removeLine}
                onSubmit={() => {
                  setCartOpen(false);
                  submit();
                }}
                pending={pending}
                outlets={outlets}
                outletId={outletId}
                setOutletId={setOutletId}
                orderChannel={orderChannel}
                setOrderChannel={setOrderChannel}
                channels={channels}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function CategoryTabs({
  categories,
  value,
  onChange,
}: {
  categories: MenuCategory[];
  value: string;
  onChange: (v: string) => void;
}) {
  const tabs = [
    { id: "all", name: "Semua" },
    ...categories.map((c) => ({ id: c.id, name: c.name })),
    { id: "uncategorized", name: "Lainnya" },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "shrink-0 px-3 h-9 rounded-full text-sm font-medium border transition-colors",
            value === t.id
              ? "bg-primary text-primary-foreground border-transparent"
              : "bg-background hover:bg-muted",
          )}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

function CartPanel(props: {
  embedded?: boolean;
  cart: CartLine[];
  itemMap: Map<string, MenuItem>;
  total: number;
  serviceType: "dine_in" | "takeaway";
  setServiceType: (v: "dine_in" | "takeaway") => void;
  selectedTableId: string;
  setSelectedTableId: (v: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  orderNotes: string;
  setOrderNotes: (v: string) => void;
  setQty: (id: string, q: number) => void;
  setLineNotes: (id: string, n: string) => void;
  removeLine: (id: string) => void;
  onSubmit: () => void;
  pending: boolean;
  outlets: Pick<Outlet, "id" | "name" | "is_temporary">[];
  outletId: string;
  setOutletId: (v: string) => void;
  orderChannel: OrderChannel;
  setOrderChannel: (v: OrderChannel) => void;
  channels: OrderChannelConfig[];
}) {
  const directChannels = props.channels.filter((ch) => ch.kind === "direct");
  const onlineChannels = props.channels.filter((ch) => ch.kind === "online");

  // Derive current kind from the active channel.
  const currentChannelKind = props.channels.find((ch) => ch.id === props.orderChannel)?.kind ?? "direct";

  function selectDirect(type: "dine_in" | "takeaway") {
    props.setServiceType(type);
    // Pick a matching direct channel if available; prefer one whose name contains the type hint.
    const hint = type === "dine_in" ? ["dine", "makan", "tempat"] : ["takeaway", "bungkus", "take"];
    const match =
      directChannels.find((ch) =>
        hint.some((h) => ch.name.toLowerCase().includes(h)),
      ) ?? directChannels[0];
    props.setOrderChannel(match?.id ?? "direct");
  }

  function selectOnline(channelId: string) {
    props.setServiceType("takeaway");
    props.setOrderChannel(channelId);
  }

  function switchKind(kind: "direct" | "online") {
    if (kind === "direct") {
      selectDirect("dine_in");
    } else {
      const first = onlineChannels[0];
      if (first) selectOnline(first.id);
    }
  }

  const tableSelectValue =
    props.selectedTableId.trim() === "" ? TABLE_NONE : props.selectedTableId;
  const tableTriggerLabel =
    tableSelectValue === TABLE_NONE
      ? "Pilih meja"
      : (() => {
          const t = findFloorTable(tableSelectValue);
          return t ? `${t.label} · ${t.seats} kursi` : tableSelectValue;
        })();

  const body = (
    <>
      <div className="space-y-3">
        {props.outlets.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="cart-outlet">
              Outlet <span className="text-destructive">*</span>
            </Label>
            <Select
              value={props.outletId}
              onValueChange={(v) => { if (v) props.setOutletId(v); }}
            >
              <SelectTrigger id="cart-outlet" className="w-full min-w-0">
                <SelectValue placeholder="Pilih outlet…">
                  {(() => { const o = props.outlets.find(o => o.id === props.outletId); return o ? `${o.name}${o.is_temporary ? " (sementara)" : ""}` : undefined; })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {props.outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}{o.is_temporary ? " (sementara)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tipe pesanan: Direct / Online */}
        <div className="space-y-2">
          <Label>Tipe pesanan</Label>
          <div className="flex gap-2">
            {(["direct", "online"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => switchKind(k)}
                className={cn(
                  "flex-1 px-3 h-10 rounded-md text-sm font-medium border transition-colors",
                  currentChannelKind === k
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-background hover:bg-muted",
                )}
              >
                {k === "direct" ? "Langsung" : "Online"}
              </button>
            ))}
          </div>
        </div>

        {/* Sumber pesanan */}
        <div className="space-y-2">
          <Label>Sumber pesanan</Label>
          {currentChannelKind === "direct" ? (
            <div className="flex gap-2">
              {(["dine_in", "takeaway"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => selectDirect(t)}
                  className={cn(
                    "flex-1 px-3 h-10 rounded-md text-sm font-medium border transition-colors",
                    props.serviceType === t
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  {t === "dine_in" ? "Dine-in" : "Takeaway"}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {onlineChannels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => selectOnline(ch.id)}
                  className={cn(
                    "px-3 h-10 rounded-md text-sm font-medium border transition-colors",
                    props.orderChannel === ch.id
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  {ch.name}
                </button>
              ))}
              {onlineChannels.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Belum ada saluran online. Tambah di Manajemen → Kanal.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Meja — only for dine-in */}
        {props.serviceType === "dine_in" && (
          <div className="space-y-1">
            <Label htmlFor="table-select">Nomor meja <span className="text-muted-foreground font-normal">(opsional)</span></Label>
            <Select
              value={tableSelectValue}
              onValueChange={(v) =>
                props.setSelectedTableId(v === TABLE_NONE ? "" : (v ?? ""))
              }
            >
              <SelectTrigger id="table-select" className="w-full min-w-0">
                {tableSelectValue === TABLE_NONE ? (
                  <span className="flex flex-1 min-w-0 truncate text-left text-muted-foreground">
                    {tableTriggerLabel}
                  </span>
                ) : (
                  <SelectValue>{tableTriggerLabel}</SelectValue>
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TABLE_NONE}>
                  Pilih meja…
                </SelectItem>
                {FLOOR_SECTIONS.map((section) => (
                  <SelectGroup key={section.id}>
                    <SelectLabel>{section.label}</SelectLabel>
                    {FLOOR_TABLES.filter((t) => t.section === section.id).map(
                      (t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label} · {t.seats} kursi
                        </SelectItem>
                      ),
                    )}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="cust">Pelanggan</Label>
          <Input
            id="cust"
            placeholder="Opsional"
            value={props.customerName}
            onChange={(e) => props.setCustomerName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        {props.cart.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Belum ada item — ketuk menu untuk menambah.
          </p>
        ) : (
          props.cart.map((line) => {
            const item = props.itemMap.get(line.itemId);
            if (!item) return null;
            return (
              <div key={line.itemId} className="border rounded-md p-3 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatIDR(item.price)} ×
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => props.removeLine(line.itemId)}
                    aria-label="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 border rounded-md">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() =>
                        props.setQty(line.itemId, line.quantity - 1)
                      }
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="w-8 text-center text-sm tabular-nums font-semibold">
                      {line.quantity}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() =>
                        props.setQty(line.itemId, line.quantity + 1)
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="ml-auto font-medium tabular-nums">
                    {formatIDR(item.price * line.quantity)}
                  </div>
                </div>
                <Input
                  placeholder="Catatan (mis. tidak pedas)"
                  value={line.notes}
                  onChange={(e) =>
                    props.setLineNotes(line.itemId, e.target.value)
                  }
                />
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="order-notes">Catatan pesanan</Label>
        <Textarea
          id="order-notes"
          rows={2}
          placeholder="Catatan umum (opsional)"
          value={props.orderNotes}
          onChange={(e) => props.setOrderNotes(e.target.value)}
        />
      </div>

      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <span className="font-medium">Total</span>
          <Badge variant="secondary" className="text-base tabular-nums">
            {formatIDR(props.total)}
          </Badge>
        </div>
        <Button
          className="w-full"
          size="lg"
          disabled={props.pending || props.cart.length === 0}
          aria-busy={props.pending}
          onClick={props.onSubmit}
        >
          {props.pending && <Spinner className="mr-2" />}
          {props.pending ? "Mengirim…" : "Buat Order"}
        </Button>
      </div>
    </>
  );

  if (props.embedded) {
    return <div className="space-y-4">{body}</div>;
  }
  return <Card className="p-5 space-y-4">{body}</Card>;
}
