"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/format";
import type {
  Discount,
  DiscountScope,
  DiscountValueType,
  MenuItem,
} from "@/lib/types";
import {
  DISCOUNT_SCOPE_LABEL,
  DISCOUNT_VALUE_TYPE_LABEL,
} from "@/lib/types";
import {
  createDiscount,
  deleteDiscount,
  updateDiscount,
} from "./actions";

const NONE = "__none__";

export function DiscountsManager({
  discounts,
  menuItems,
}: {
  discounts: Discount[];
  menuItems: Pick<MenuItem, "id" | "name">[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Discount | "new" | null>(null);

  function close() {
    setEditing(null);
  }

  function onSubmit(formData: FormData) {
    start(async () => {
      const isNew = editing === "new";
      if (!isNew && editing) formData.set("id", editing.id);
      const action = isNew ? createDiscount : updateDiscount;
      const res = await action(formData);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isNew ? "Diskon dibuat" : "Diskon diperbarui");
      close();
      router.refresh();
    });
  }

  function remove(d: Discount) {
    if (!confirm(`Hapus diskon "${d.name}"?`)) return;
    start(async () => {
      const res = await deleteDiscount(d.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Diskon dihapus");
      router.refresh();
    });
  }

  const menuMap = new Map(menuItems.map((m) => [m.id, m.name]));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-2" />
          Diskon baru
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {discounts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Belum ada diskon. Buat diskon pertama untuk mulai memberi potongan.
            </p>
            <Button variant="outline" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4 mr-2" /> Diskon baru
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Nilai</TableHead>
                <TableHead>Berlaku</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-medium">{d.name}</div>
                    {d.scope === "menu_item" && d.menu_item_id && (
                      <div className="text-xs text-muted-foreground">
                        Item: {menuMap.get(d.menu_item_id) ?? "—"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {DISCOUNT_SCOPE_LABEL[d.scope]}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {d.value_type === "percent"
                      ? `${d.value}%`
                      : formatIDR(d.value)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.active_from || d.active_until
                      ? `${d.active_from ?? "…"} – ${d.active_until ?? "…"}`
                      : "Selalu"}
                  </TableCell>
                  <TableCell>
                    {d.is_active ? (
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(d)}
                        aria-label="Ubah"
                        disabled={pending}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(d)}
                        aria-label="Hapus"
                        disabled={pending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {editing && (
        <DiscountForm
          discount={editing === "new" ? null : editing}
          menuItems={menuItems}
          pending={pending}
          onCancel={close}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

function DiscountForm({
  discount,
  menuItems,
  pending,
  onCancel,
  onSubmit,
}: {
  discount: Discount | null;
  menuItems: Pick<MenuItem, "id" | "name">[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const [scope, setScope] = useState<DiscountScope>(
    discount?.scope ?? "transaction",
  );
  const [valueType, setValueType] = useState<DiscountValueType>(
    discount?.value_type ?? "percent",
  );
  const [menuItemId, setMenuItemId] = useState<string>(
    discount?.menu_item_id ?? "",
  );
  const [isActive, setIsActive] = useState<boolean>(discount?.is_active ?? true);

  function handle(formData: FormData) {
    formData.set("scope", scope);
    formData.set("value_type", valueType);
    if (scope === "menu_item") formData.set("menu_item_id", menuItemId);
    else formData.delete("menu_item_id");
    if (isActive) formData.set("is_active", "on");
    else formData.delete("is_active");
    onSubmit(formData);
  }

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold mb-4">
        {discount ? "Ubah diskon" : "Diskon baru"}
      </h2>
      <form action={handle} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="d-name">Nama</Label>
          <Input
            id="d-name"
            name="name"
            required
            defaultValue={discount?.name ?? ""}
            placeholder="mis. Promo Jumat"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-scope">Tipe diskon</Label>
          <Select value={scope} onValueChange={(v) => v && setScope(v as DiscountScope)}>
            <SelectTrigger id="d-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="menu_item">Per item menu</SelectItem>
              <SelectItem value="transaction">Per transaksi</SelectItem>
              <SelectItem value="daily">Promo harian</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {scope === "menu_item" && "Diterapkan hanya untuk item tertentu."}
            {scope === "transaction" && "Diterapkan pada total transaksi (manual oleh kasir)."}
            {scope === "daily" && "Berlaku otomatis dalam rentang tanggal yang ditentukan."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-value-type">Tipe nilai</Label>
          <Select value={valueType} onValueChange={(v) => v && setValueType(v as DiscountValueType)}>
            <SelectTrigger id="d-value-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">{DISCOUNT_VALUE_TYPE_LABEL.percent}</SelectItem>
              <SelectItem value="amount">{DISCOUNT_VALUE_TYPE_LABEL.amount}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-value">
            Nilai {valueType === "percent" ? "(%)" : "(Rp)"}
          </Label>
          <Input
            id="d-value"
            name="value"
            type="number"
            min="0"
            step={valueType === "percent" ? "0.1" : "1"}
            required
            defaultValue={discount?.value ?? ""}
            placeholder={valueType === "percent" ? "10" : "5000"}
          />
        </div>

        {scope === "menu_item" && (
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="d-menu-item">Item menu</Label>
            <Select
              value={menuItemId || NONE}
              onValueChange={(v) => setMenuItemId(!v || v === NONE ? "" : v)}
            >
              <SelectTrigger id="d-menu-item">
                <SelectValue placeholder="Pilih item…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {menuItems.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {scope === "daily" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="d-from">Berlaku dari</Label>
              <Input
                id="d-from"
                name="active_from"
                type="date"
                defaultValue={discount?.active_from ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-until">Berlaku sampai</Label>
              <Input
                id="d-until"
                name="active_until"
                type="date"
                defaultValue={discount?.active_until ?? ""}
              />
            </div>
          </>
        )}

        <label className="flex items-center gap-2 cursor-pointer md:col-span-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm">Aktif</span>
        </label>

        <div className="md:col-span-2 flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Batal
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending && <Spinner className="mr-2" />}
            {pending ? "Menyimpan…" : discount ? "Simpan" : "Buat diskon"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
