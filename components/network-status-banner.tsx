"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function NetworkStatusBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  if (online) return null;

  return (
    <div
      data-print-hide
      role="alert"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-destructive text-destructive-foreground text-sm py-2 px-4"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Tidak ada koneksi — beberapa fitur mungkin tidak berfungsi</span>
    </div>
  );
}
