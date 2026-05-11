"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
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
import type { MenuCategory, MenuItem } from "@/lib/types";
import { startRouteProgress } from "@/components/route-progress";
import { FullScreenLoading } from "@/components/full-screen-loading";
import { createOrder } from "../actions";

type CartLine = {
  itemId: string;
  quantity: number;
  notes: string;
};

export function NewOrderClient({
  items,
  categories,
}: {
  items: MenuItem[];
  categories: MenuCategory[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return items;
    if (selectedCategory === "uncategorized")
      return items.filter((i) => !i.category_id);
    return items.filter((i) => i.category_id === selectedCategory);
  }, [items, selectedCategory]);

  const totalItems = cart.reduce((s, l) => s + l.quantity, 0);
  const total = cart.reduce((s, l) => {
    const it = itemMap.get(l.itemId);
    return s + (it ? it.price * l.quantity : 0);
  }, 0);

  function addToCart(itemId: string) {
    setCart((c) => {
      const existing = c.find((l) => l.itemId === itemId);
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
    start(async () => {
      const res = await createOrder({
        table_number: tableNumber.trim() || undefined,
        customer_name: customerName.trim() || undefined,
        notes: orderNotes.trim() || undefined,
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
        <CategoryTabs
          categories={categories}
          value={selectedCategory}
          onChange={setSelectedCategory}
        />

        {filteredItems.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            Tidak ada item di kategori ini.
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((it) => {
              const qty =
                cart.find((l) => l.itemId === it.id)?.quantity ?? 0;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => addToCart(it.id)}
                  className={cn(
                    "group text-left rounded-lg border bg-card hover:border-primary hover:shadow-sm active:scale-[0.98] transition overflow-hidden touch-manipulation",
                    qty > 0 && "ring-2 ring-primary border-transparent",
                  )}
                >
                  <div className="relative aspect-square bg-muted">
                    {it.image_url ? (
                      <Image
                        src={it.image_url}
                        alt={it.name}
                        fill
                        sizes="(max-width:640px) 50vw, 25vw"
                        className="object-cover"
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
            tableNumber={tableNumber}
            setTableNumber={setTableNumber}
            customerName={customerName}
            setCustomerName={setCustomerName}
            orderNotes={orderNotes}
            setOrderNotes={setOrderNotes}
            setQty={setQty}
            setLineNotes={setLineNotes}
            removeLine={removeLine}
            onSubmit={submit}
            pending={pending}
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
                tableNumber={tableNumber}
                setTableNumber={setTableNumber}
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
  tableNumber: string;
  setTableNumber: (v: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  orderNotes: string;
  setOrderNotes: (v: string) => void;
  setQty: (id: string, q: number) => void;
  setLineNotes: (id: string, n: string) => void;
  removeLine: (id: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const body = (
    <>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="table">Meja</Label>
            <Input
              id="table"
              placeholder="mis. 12"
              value={props.tableNumber}
              onChange={(e) => props.setTableNumber(e.target.value)}
            />
          </div>
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
          {props.pending ? "Mengirim…" : "Kirim ke dapur"}
        </Button>
      </div>
    </>
  );

  if (props.embedded) {
    return <div className="space-y-4">{body}</div>;
  }
  return <Card className="p-5 space-y-4">{body}</Card>;
}
