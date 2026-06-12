import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, LogOut } from "lucide-react";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["super_admin"]);

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-sm">Solusi Saji</span>
            <span className="text-xs text-muted-foreground ml-2">Product Team</span>
          </div>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground gap-2">
            <LogOut className="h-4 w-4" />
            Keluar
          </Button>
        </form>
      </header>
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
