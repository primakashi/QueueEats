"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createMenuItem,
  updateMenuItem,
  reorderMenuItems,
} from "@/app/(app)/admin/actions";
import { startRouteProgress } from "@/components/route-progress";
import type { MenuCategory, MenuItem, OrderChannelConfig } from "@/lib/types";

const UNCATEGORIZED = "__none__";

type SiblingItem = { id: string; name: string; sort_order: number };

export function MenuItemForm({
  categories,
  channels,
  assignedChannelIds,
  item,
  siblingItems,
}: {
  categories: MenuCategory[];
  channels: OrderChannelConfig[];
  assignedChannelIds?: string[];
  item?: MenuItem;
  siblingItems?: SiblingItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(item?.image_url ?? null);
  const [categoryId, setCategoryId] = useState<string>(
    item ? item.category_id ?? UNCATEGORIZED : categories[0]?.id ?? UNCATEGORIZED,
  );
  const [available, setAvailable] = useState<boolean>(item?.is_available ?? true);
  const [allChannels, setAllChannels] = useState<boolean>(
    (assignedChannelIds?.length ?? 0) === 0,
  );
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(
    new Set(assignedChannelIds ?? []),
  );

  const initialCategoryId = item?.category_id ?? UNCATEGORIZED;
  const categoryChanged = categoryId !== initialCategoryId;

  const currentPositionIdx = useMemo(() => {
    if (!item || !siblingItems) return -1;
    return siblingItems.findIndex((s) => s.id === item.id);
  }, [item, siblingItems]);

  const [positionIdx, setPositionIdx] = useState<number>(currentPositionIdx);

  function toggleChannel(id: string) {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  function onSubmit(formData: FormData) {
    formData.set("category_id", categoryId === UNCATEGORIZED ? "" : categoryId);
    if (available) formData.set("is_available", "on");
    else formData.delete("is_available");
    if (item) formData.set("id", item.id);

    // Channel selection: "all" mode submits no channel_ids (= available everywhere).
    // Guard the surprising case where the user picked "specific channels" but
    // selected none — that would silently fall through to "available everywhere".
    if (!allChannels && selectedChannelIds.size === 0) {
      toast.error("Pilih minimal satu channel atau gunakan 'Semua channel'");
      return;
    }
    formData.delete("channel_ids");
    if (!allChannels) {
      for (const id of selectedChannelIds) formData.append("channel_ids", id);
    }

    start(async () => {
      try {
        const action = item ? updateMenuItem : createMenuItem;
        const res = await action(formData);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }

        // Reorder siblings if position changed and category is unchanged
        if (
          item &&
          siblingItems &&
          siblingItems.length > 1 &&
          !categoryChanged &&
          positionIdx >= 0 &&
          positionIdx !== currentPositionIdx
        ) {
          const without = siblingItems.filter((s) => s.id !== item.id);
          without.splice(positionIdx, 0, { id: item.id, name: item.name, sort_order: 0 });
          await reorderMenuItems(item.category_id, without.map((s) => s.id));
        }

        toast.success(item ? "Item menu diperbarui" : "Item menu dibuat");
        startRouteProgress();
        router.push("/admin/menu");
        router.refresh();
      } catch (err) {
        console.error("[menu-form] save threw", err);
        toast.error("Gagal menyimpan menu. Coba lagi.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={onSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-[1fr_200px]">

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={item?.name ?? ""}
                  placeholder="mis. Nasi Goreng Spesial"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={item?.description ?? ""}
                  placeholder="Deskripsi (opsional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Harga jual (IDR)</Label>
                  <CurrencyInput
                    id="price"
                    name="price"
                    required
                    defaultValue={item?.price ?? 0}
                    placeholder="35000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost_price">HPP / Modal (IDR)</Label>
                  <CurrencyInput
                    id="cost_price"
                    name="cost_price"
                    defaultValue={item?.cost_price ?? 0}
                    placeholder="12000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Biaya bahan baku per unit. Dipakai untuk laporan profit pemilik.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission_rate">
                  Komisi per item (%) <span className="text-muted-foreground font-normal">(opsional)</span>
                </Label>
                <Input
                  id="commission_rate"
                  name="commission_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={
                    item?.commission_rate != null
                      ? Number((item.commission_rate * 100).toFixed(2)).toString()
                      : ""
                  }
                  placeholder="Kosongkan untuk pakai komisi channel"
                />
                <p className="text-xs text-muted-foreground">
                  Kosongkan agar laporan pakai komisi default channel (mis. GoFood 20%).
                  Isi hanya jika item ini punya tarif khusus.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Kategori</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => setCategoryId(v ?? UNCATEGORIZED)}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Pilih kategori">
                      {categoryId === UNCATEGORIZED
                        ? "Lainnya"
                        : categories.find((c) => c.id === categoryId)?.name ?? "Pilih kategori"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={UNCATEGORIZED}>Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {item && siblingItems && siblingItems.length > 1 && !categoryChanged && (
                <div className="space-y-2">
                  <Label htmlFor="position">Urutan dalam kategori</Label>
                  <Select
                    value={String(positionIdx + 1)}
                    onValueChange={(v) => setPositionIdx(Number(v) - 1)}
                  >
                    <SelectTrigger id="position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {siblingItems.map((_, idx) => (
                        <SelectItem key={idx} value={String(idx + 1)}>
                          {idx + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pilih posisi urutan item ini dalam kategorinya.
                  </p>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">Tersedia untuk dipesan</span>
              </label>

              <div className="space-y-2 pt-1">
                <Label>Tersedia di channel</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="channel-mode"
                      checked={allChannels}
                      onChange={() => setAllChannels(true)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm">Semua channel</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="channel-mode"
                      checked={!allChannels}
                      onChange={() => setAllChannels(false)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm">Pilih channel tertentu</span>
                  </label>
                  {!allChannels && (
                    <div className="ml-7 flex flex-wrap gap-2 pt-1">
                      {channels.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Belum ada channel. Tambah di Manajemen → Kanal.
                        </p>
                      ) : (
                        channels.map((ch) => {
                          const on = selectedChannelIds.has(ch.id);
                          return (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={() => toggleChannel(ch.id)}
                              className={`text-xs rounded-full border px-3 py-1.5 transition-colors ${
                                on
                                  ? "bg-primary text-primary-foreground border-transparent"
                                  : "bg-background hover:bg-muted"
                              }`}
                            >
                              {ch.name}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Atur agar item ini hanya muncul di channel tertentu (mis. menu khusus pop-up).
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Gambar</Label>
              <div className="relative aspect-square rounded-md border border-dashed bg-muted overflow-hidden">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt="Pratinjau"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                    Tanpa gambar
                  </div>
                )}
              </div>
              <Input
                id="image"
                name="image"
                type="file"
                accept="image/*"
                onChange={onFile}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={pending}
              render={<Link href="/admin/menu" />}
            >
              Batal
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending && <Spinner className="mr-2" />}
              {pending ? "Menyimpan…" : item ? "Simpan perubahan" : "Buat item"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
