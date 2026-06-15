"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Check, X, Pencil, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
} from "@/app/(app)/admin/actions";
import { useRouter } from "next/navigation";
import type { MenuCategory } from "@/lib/types";

type Busy =
  | { kind: "create" }
  | { kind: "update"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "reorder" };

export function CategoriesManager({
  categories,
}: {
  categories: MenuCategory[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<Busy | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  // Local optimistic order; resets when server data changes.
  const [order, setOrder] = useState<MenuCategory[]>(categories);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    setOrder(categories);
  }, [categories]);

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy({ kind: "create" });
    start(async () => {
      const fd = new FormData();
      fd.set("name", newName);
      const res = await createCategory(fd);
      if (!res.ok) {
        toast.error(res.error);
        setBusy(null);
        return;
      }
      setNewName("");
      setBusy(null);
      router.refresh();
    });
  }

  function beginEdit(c: MenuCategory) {
    setEditingId(c.id);
    setEditName(c.name);
  }

  function saveEdit() {
    if (!editingId) return;
    const id = editingId;
    setBusy({ kind: "update", id });
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("name", editName);
      const res = await updateCategory(fd);
      if (!res.ok) {
        toast.error(res.error);
        setBusy(null);
        return;
      }
      setEditingId(null);
      setBusy(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Hapus kategori ini? Item menu akan jadi tanpa kategori.")) return;
    setBusy({ kind: "delete", id });
    start(async () => {
      const res = await deleteCategory(id);
      if (!res.ok) {
        toast.error(res.error);
        setBusy(null);
        return;
      }
      setBusy(null);
      router.refresh();
    });
  }

  function persistOrder(next: MenuCategory[]) {
    // Compare against last-known server state (categories prop), not local order.
    const baselineIds = categories.map((c) => c.id).join(",");
    const nextIds = next.map((c) => c.id).join(",");
    if (baselineIds === nextIds) return;
    setBusy({ kind: "reorder" });
    start(async () => {
      const res = await reorderCategories(next.map((c) => c.id));
      if (!res.ok) {
        toast.error(res.error);
        setOrder(categories);
        setBusy(null);
        return;
      }
      setBusy(null);
      router.refresh();
    });
  }

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    setOrder((current) => {
      const from = current.findIndex((c) => c.id === draggingId);
      const to = current.findIndex((c) => c.id === overId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleDragEnd() {
    setDraggingId(null);
    persistOrder(order);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submitNew} className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Nama</label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="mis. Minuman"
          />
        </div>
        <Button
          type="submit"
          disabled={pending}
          aria-busy={busy?.kind === "create"}
        >
          {busy?.kind === "create" ? (
            <Spinner className="mr-1.5" />
          ) : (
            <Plus className="h-4 w-4 mr-1.5" />
          )}
          {busy?.kind === "create" ? "Menambahkan…" : "Tambah"}
        </Button>
      </form>

      <div className="border rounded-md divide-y">
        {order.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            Belum ada kategori
          </div>
        ) : (
          order.map((c) =>
            editingId === c.id ? (
              <div key={c.id} className="p-3 flex gap-2 items-center">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={saveEdit}
                  disabled={pending}
                  aria-busy={busy?.kind === "update" && busy.id === c.id}
                  aria-label="Simpan"
                >
                  {busy?.kind === "update" && busy.id === c.id ? (
                    <Spinner />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                  disabled={pending}
                  aria-label="Batal"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                key={c.id}
                draggable
                onDragStart={() => handleDragStart(c.id)}
                onDragOver={(e) => handleDragOver(e, c.id)}
                onDragEnd={handleDragEnd}
                className={`p-3 flex items-center gap-3 cursor-move ${
                  draggingId === c.id ? "opacity-50 bg-muted/40" : ""
                }`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 font-medium">{c.name}</div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => beginEdit(c)}
                  disabled={pending}
                  aria-label="Ubah"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(c.id)}
                  disabled={pending}
                  aria-busy={busy?.kind === "delete" && busy.id === c.id}
                  aria-label="Hapus"
                >
                  {busy?.kind === "delete" && busy.id === c.id ? (
                    <Spinner />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ),
          )
        )}
      </div>
      {busy?.kind === "reorder" && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Spinner /> Menyimpan urutan…
        </div>
      )}
    </div>
  );
}
