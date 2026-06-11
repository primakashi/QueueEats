"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FullScreenLoading } from "@/components/full-screen-loading";
import {
  startRouteProgress,
  endRouteProgress,
} from "@/components/route-progress";
import { signIn } from "./actions";
import { toast } from "sonner";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(email: string, password: string) {
    setError(null);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("password", password);
    if (redirectTo) fd.set("redirect", redirectTo);
    startTransition(async () => {
      startRouteProgress();
      const result = await signIn(fd);
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
