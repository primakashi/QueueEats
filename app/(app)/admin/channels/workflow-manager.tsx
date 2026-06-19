"use client";

import { useState, useTransition } from "react";
import { ChefHat, Hand } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import type { OrderWorkflowMode, Restaurant } from "@/lib/types";
import { updateOrderWorkflow } from "./actions";

const OPTIONS: Array<{
  id: OrderWorkflowMode;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "standard",
    label: "Standar",
    desc: "Pesanan melalui dapur: Baru → Diterima → Diproses → Siap → Selesai.",
    Icon: ChefHat,
  },
  {
    id: "no_kitchen",
    label: "Tanpa dapur",
    desc: "Tidak ada langkah diproses. Pesanan langsung: Baru → Diterima → Siap → Selesai.",
    Icon: Hand,
  },
];

export function WorkflowManager({ restaurant }: { restaurant: Restaurant | null }) {
  const current: OrderWorkflowMode = restaurant?.order_workflow ?? "standard";
  const [selected, setSelected] = useState<OrderWorkflowMode>(current);
  const [pending, start] = useTransition();

  function choose(mode: OrderWorkflowMode) {
    if (mode === selected) return;
    setSelected(mode);
    start(async () => {
      const res = await updateOrderWorkflow(mode);
      if (!res.ok) {
        toast.error(res.error);
        setSelected(current);
        return;
      }
      toast.success("Mode workflow disimpan");
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="text-sm font-semibold">Mode workflow pesanan</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Atur alur transisi status pesanan agar cocok dengan operasional restoran ini.
          Perubahan langsung memengaruhi aksi yang tampil di layar waiter dan dapur.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {OPTIONS.map((o) => {
          const active = selected === o.id;
          const Icon = o.Icon;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o.id)}
              disabled={pending}
              className={`text-left rounded-xl border p-4 transition-colors ${
                active
                  ? "border-primary bg-primary/5"
                  : "bg-card hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex size-8 items-center justify-center rounded-lg ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                </span>
                <div className="font-medium text-sm">{o.label}</div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{o.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
