"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RotateCcw, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reopenOrder } from "./edit-actions";

export function ReopenButton({
  orderId,
  disabled,
}: {
  orderId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function trigger() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    start(async () => {
      const res = await reopenOrder(orderId);
      if (!res.ok) {
        toast.error(res.error);
        setConfirm(false);
        return;
      }
      toast.success("Pesanan dibuka kembali untuk revisi");
      router.refresh();
      setConfirm(false);
    });
  }

  return (
    <Button
      variant={confirm ? "destructive" : "outline"}
      size="sm"
      onClick={trigger}
      onBlur={() => setConfirm(false)}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      <RotateCcw className="h-4 w-4 mr-1.5" />
      {confirm ? "Konfirmasi buka kembali" : "Buka kembali"}
    </Button>
  );
}

export function AddonOrderButton({ parentId }: { parentId: string }) {
  return (
    <Button variant="outline" size="sm" render={<Link href={`/waiter/new?addon=${parentId}`} />}>
      <PlusCircle className="h-4 w-4 mr-1.5" />
      Pesanan tambahan
    </Button>
  );
}
