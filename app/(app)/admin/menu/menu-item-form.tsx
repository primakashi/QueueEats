"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/app/(app)/admin/actions";
import { startRouteProgress } from "@/components/route-progress";
import type { MenuCategory, MenuItem } from "@/lib/types";

export function MenuItemForm({
  categories,
  item,
}: {
  categories: MenuCategory[];
  item?: MenuItem;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(item?.image_url ?? null);
  const [categoryId, setCategoryId] = useState<string>(
    item?.category_id ?? (categories[0]?.id ?? ""),
  );
  const [available, setAvailable] = useState<boolean>(item?.is_available ?? true);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  function onSubmit(formData: FormData) {
    formData.set("category_id", categoryId);
    if (available) formData.set("is_available", "on");
    else formData.delete("is_available");
    if (item) formData.set("id", item.id);

    start(async () => {
      const action = item ? updateMenuItem : createMenuItem;
      const res = await action(formData);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(item ? "Menu item updated" : "Menu item created");
      startRouteProgress();
      router.push("/admin/menu");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={onSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-[1fr_200px]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={item?.name ?? ""}
                  placeholder="e.g. Nasi Goreng Special"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={item?.description ?? ""}
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (IDR)</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="500"
                    required
                    defaultValue={item?.price ?? ""}
                    placeholder="35000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={categoryId}
                    onValueChange={(v) => setCategoryId(v ?? "")}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">Available for ordering</span>
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Image</Label>
              <div className="relative aspect-square rounded-md border border-dashed bg-muted overflow-hidden">
                {preview ? (
                  <Image
                    src={preview}
                    alt="Preview"
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                    No image
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
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/menu")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending && <Spinner className="mr-2" />}
              {pending ? "Saving…" : item ? "Save changes" : "Create item"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
