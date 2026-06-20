"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">Halaman gagal dimuat</h1>
          <p className="text-sm text-muted-foreground">
            Coba lagi. Jika terus terjadi, muat ulang halaman.
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => unstable_retry()}>Coba lagi</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Muat ulang
          </Button>
        </div>
      </div>
    </div>
  );
}
