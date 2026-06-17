import { requireRole } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { SolusiSajiMark } from "@/components/solusi-saji-mark";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["super_admin"]);

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SolusiSajiMark className="h-7 w-auto" />
          <span className="text-xs text-muted-foreground">Super Admin</span>
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
