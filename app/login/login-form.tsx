"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, UtensilsCrossed, ChefHat, Receipt, Crown } from "lucide-react";
import { FullScreenLoading } from "@/components/full-screen-loading";
import {
  startRouteProgress,
  endRouteProgress,
} from "@/components/route-progress";
import { signIn } from "./actions";
import { toast } from "sonner";

const DEMO_PASSWORD = "Passw0rd";
const DEMO_ACCOUNTS = [
  { role: "Admin",        email: "admin@google.com",   Icon: Shield,         span: false },
  { role: "Waiters/Host", email: "waiter@google.com",  Icon: UtensilsCrossed, span: false },
  { role: "Dapur",        email: "kitchen@google.com", Icon: ChefHat,        span: false },
  { role: "Kasir",        email: "cashier@google.com", Icon: Receipt,        span: false },
  { role: "Owner",        email: "owner@google.com",   Icon: Crown,          span: true  },
] as const;

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  function submit(email: string, password: string) {
    setError(null);
    setPendingEmail(email);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("password", password);
    if (redirectTo) fd.set("redirect", redirectTo);
    startTransition(async () => {
      startRouteProgress();
      const result = await signIn(fd);
      setPendingEmail(null);
      if (result?.error) {
        endRouteProgress();
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  function onSubmit(formData: FormData) {
    submit(
      String(formData.get("email") ?? "").trim(),
      String(formData.get("password") ?? ""),
    );
  }

  return (
    <Card>
      {isPending && (
        <FullScreenLoading title="Sedang masuk…" />
      )}
      <CardContent className="pt-6 space-y-5">
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map(({ role, email, Icon, span }) => {
            const busy = isPending && pendingEmail === email;
            return (
              <button
                key={email}
                type="button"
                disabled={isPending}
                onClick={() => submit(email, DEMO_PASSWORD)}
                className={`group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition hover:border-primary hover:shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none touch-manipulation${span ? " col-span-2" : ""}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight">
                    {busy ? "Masuk..." : role}
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {email}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-card px-2 text-muted-foreground">
              atau masuk manual
            </span>
          </div>
        </div>

        <form action={onSubmit} className="space-y-4" aria-busy={isPending}>
          {redirectTo && (
            <input type="hidden" name="redirect" value={redirectTo} />
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="staf@restoran.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Kata sandi</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Masuk..." : "Masuk"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
