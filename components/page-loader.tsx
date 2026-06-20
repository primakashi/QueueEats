import { Loader2 } from "lucide-react";

export function PageLoader({ title = "Memuat…" }: { title?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 min-h-[70vh] w-full p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-16 w-16 animate-spin text-primary" aria-hidden />
      <p className="text-base font-medium text-muted-foreground">{title}</p>
    </div>
  );
}
