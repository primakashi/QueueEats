"use client";

import { useTransition } from "react";
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
  const next = !available;
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          const res = await toggleMenuItemAvailability(id, next);
          if (!res.ok) toast.error(res.error);
        })
      }
      className="disabled:opacity-80"
      aria-label={available ? "Mark as unavailable" : "Mark as available"}
    >
      <Badge
        className={cn(
          "border gap-1",
          available
            ? "bg-emerald-500 hover:bg-emerald-600 text-white border-transparent"
            : "bg-background text-muted-foreground",
        )}
      >
        {pending && <Spinner size="xs" />}
        {available ? "Available" : "Hidden"}
      </Badge>
    </button>
  );
}
