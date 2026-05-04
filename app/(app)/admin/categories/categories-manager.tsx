"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/app/(app)/admin/actions";
import { useRouter } from "next/navigation";
import type { MenuCategory } from "@/lib/types";

export function CategoriesManager({
  categories,
}: {
  categories: MenuCategory[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");
  const [newSort, setNewSort] = useState("0");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSort, setEditSort] = useState("0");

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    start(async () => {
      const fd = new FormData();
      fd.set("name", newName);
      fd.set("sort_order", newSort);
      const res = await createCategory(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setNewName("");
      setNewSort("0");
      router.refresh();
    });
  }

  function beginEdit(c: MenuCategory) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditSort(String(c.sort_order));
  }

  function saveEdit() {
    if (!editingId) return;
    start(async () => {
      const fd = new FormData();
      fd.set("id", editingId);
      fd.set("name", editName);
      fd.set("sort_order", editSort);
      const res = await updateCategory(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this category? Menu items will become uncategorized.")) return;
    start(async () => {
      const res = await deleteCategory(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submitNew} className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Drinks"
          />
        </div>
        <div className="w-24 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Sort</label>
          <Input
            value={newSort}
            onChange={(e) => setNewSort(e.target.value)}
            type="number"
          />
        </div>
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4 mr-1.5" /> Add
        </Button>
      </form>

      <div className="border rounded-md divide-y">
        {categories.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            No categories yet
          </div>
        ) : (
          categories.map((c) =>
            editingId === c.id ? (
              <div key={c.id} className="p-3 flex gap-2 items-center">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1"
                />
                <Input
                  value={editSort}
                  onChange={(e) => setEditSort(e.target.value)}
                  type="number"
                  className="w-20"
                />
                <Button size="icon" variant="ghost" onClick={saveEdit} disabled={pending}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div key={c.id} className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Sort order: {c.sort_order}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => beginEdit(c)}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(c.id)}
                  disabled={pending}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
