import { Spinner } from "@/components/ui/spinner";

export default function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
      <div className="flex items-center gap-2 text-sm">
        <Spinner size="sm" />
        <span>Loading…</span>
      </div>
    </div>
  );
}
