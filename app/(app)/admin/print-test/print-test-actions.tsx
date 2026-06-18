"use client";

import { Printer, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openPrintWindow } from "@/lib/print";

export function PrintTestActions() {
  const tryOpen = (url: string) => {
    if (!openPrintWindow(url)) {
      toast.error(
        "Browser memblokir jendela cetak. Aktifkan popup untuk situs ini, lalu coba lagi.",
      );
    }
  };

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Button
        type="button"
        size="lg"
        className="h-14 text-base gap-3"
        onClick={() => tryOpen("/admin/print-test/struk")}
      >
        <Printer className="h-5 w-5 shrink-0" />
        Tes Cetak Struk
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-14 text-base gap-3"
        onClick={() => tryOpen("/admin/print-test/tiket")}
      >
        <ChefHat className="h-5 w-5 shrink-0" />
        Tes Cetak Tiket Dapur
      </Button>
    </div>
  );
}
