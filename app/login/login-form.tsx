"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);

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
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
