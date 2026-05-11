import { Loader2 } from "lucide-react";

export default function SalesPageLoading() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">Memuat…</p>
    </div>
  );
}
