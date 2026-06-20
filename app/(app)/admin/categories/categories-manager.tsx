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

  // Mirror server-supplied categories into the local optimistic order whenever
  // the prop changes (e.g. after a successful mutation + revalidate). Suppress
  // the React 19 "no setState in effect" rule: the alternatives (useMemo with
  // a separate "local reorder" buffer, or a key-on-parent reset) add more
  // surface than the bug they prevent for this small list.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(categories);
  }, [categories]);

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy({ kind: "create" });
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("name", newName);
        const res = await createCategory(fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setNewName("");
        router.refresh();
      } catch (err) {
        console.error("[categories] createCategory threw", err);
        toast.error("Gagal menambah kategori. Coba lagi.");
      } finally {
        setBusy(null);
      }
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
      try {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("name", editName);
        const res = await updateCategory(fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setEditingId(null);
        router.refresh();
      } catch (err) {
        console.error("[categories] updateCategory threw", err);
        toast.error("Gagal menyimpan kategori. Coba lagi.");
      } finally {
        setBusy(null);
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Hapus kategori ini? Item menu akan jadi tanpa kategori.")) return;
    setBusy({ kind: "delete", id });
    start(async () => {
      try {
        const res = await deleteCategory(id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        router.refresh();
      } catch (err) {
        console.error("[categories] deleteCategory threw", err);
        toast.error("Gagal menghapus kategori. Coba lagi.");
      } finally {
        setBusy(null);
      }
    });
  }

  function persistOrder(next: MenuCategory[]) {
    // Compare against last-known server state (categories prop), not local order.
    const baselineIds = categories.map((c) => c.id).join(",");
    const nextIds = next.map((c) => c.id).join(",");
    if (baselineIds === nextIds) return;
    setBusy({ kind: "reorder" });
    start(async () => {
      try {
        const res = await reorderCategories(next.map((c) => c.id));
        if (!res.ok) {
          toast.error(res.error);
          setOrder(categories);
          return;
        }
        router.refresh();
      } catch (err) {
        console.error("[categories] reorderCategories threw", err);
        toast.error("Gagal menyimpan urutan. Coba lagi.");
        setOrder(categories);
      } finally {
        setBusy(null);
      }
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
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Nama kategori</label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="mis. Minuman"
            className="h-10"
          />
        </div>
        <Button
          type="submit"
          disabled={pending}
          aria-busy={busy?.kind === "create"}
          className="h-10"
        >
          {busy?.kind === "create" ? (
            <Spinner className="mr-1.5" />
          ) : (
            <Plus className="h-4 w-4 mr-1.5" />
          )}
          {busy?.kind === "create" ? "Menambahkan…" : "Tambah"}
        </Button>
      </form>

      {order.length === 0 ? (
        <div className="border rounded-lg p-10 text-sm text-muted-foreground text-center">
          Belum ada kategori. Tambah kategori pertama di atas.
        </div>
      ) : (
        <div className="space-y-2">
          {order.map((c) =>
            editingId === c.id ? (
              <div key={c.id} className="rounded-lg border bg-card p-3 flex gap-2 items-center">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 h-10"
                  autoFocus
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
                className={`rounded-lg border bg-card px-4 py-3 flex items-center gap-3 cursor-move transition-colors hover:border-foreground/20 ${
                  draggingId === c.id ? "opacity-50 bg-muted/40" : ""
                }`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 font-medium text-sm">{c.name}</div>
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
                  className="text-destructive hover:text-destructive"
                >
                  {busy?.kind === "delete" && busy.id === c.id ? (
                    <Spinner />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ),
          )}
        </div>
      )}
      {busy?.kind === "reorder" && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Spinner /> Menyimpan urutan…
        </div>
      )}
    </div>
  );
}
