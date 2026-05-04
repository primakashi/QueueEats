import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="flex-1 grid place-items-center p-8">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-muted-foreground">
          Your account does not have permission to view that page.
        </p>
        <Button render={<Link href="/" />}>Back home</Button>
      </div>
    </main>
  );
}
