"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toggleMenuItemAvailability } from "@/app/(app)/admin/actions";
import { cn } from "@/lib/utils";

export function AvailabilityToggle({
  id,
  available,
}: {
  id: string;
  available: boolean;
}) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState(available);
  const next = !optimistic;
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        setOptimistic(next);
        start(async () => {
          try {
            const res = await toggleMenuItemAvailability(id, next);
            if (!res.ok) {
              toast.error(res.error);
              setOptimistic(!next);
            }
          } catch (err) {
            console.error("[menu] toggleMenuItemAvailability threw", err);
            toast.error("Gagal mengubah ketersediaan. Coba lagi.");
            setOptimistic(!next);
          }
        });
      }}
      className="disabled:opacity-80"
      aria-label={optimistic ? "Tandai tidak tersedia" : "Tandai tersedia"}
    >
      <Badge
        className={cn(
          "border gap-1",
          optimistic
            ? "bg-emerald-500 hover:bg-emerald-600 text-white border-transparent"
            : "bg-background text-muted-foreground",
        )}
      >
        {pending && <Spinner size="xs" />}
        {optimistic ? "Tersedia" : "Disembunyikan"}
      </Badge>
    </button>
  );
}
