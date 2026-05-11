"use client";

import { Loader2 } from "lucide-react";

type FullScreenLoadingProps = {
  title: string;
  description?: string;
};

export function FullScreenLoading({
  title,
  description = "Mohon tunggu, jangan tutup halaman ini.",
}: FullScreenLoadingProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium px-4 text-center">{title}</p>
      <p className="text-xs text-muted-foreground px-6 text-center max-w-sm">
        {description}
      </p>
    </div>
  );
}
