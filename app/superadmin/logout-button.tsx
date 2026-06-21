"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { signOut } from "@/app/login/actions";

export function LogoutButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground gap-2"
      disabled={pending}
      aria-busy={pending}
      onClick={() => start(() => signOut())}
    >
      {pending ? <Spinner className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
      Keluar
    </Button>
  );
}
