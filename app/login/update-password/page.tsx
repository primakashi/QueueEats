"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { updatePassword } from "./actions";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePassword(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Kata sandi berhasil diperbarui");
      router.push("/login");
    });
  }

  return (
    <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6 bg-muted/30 [-webkit-overflow-scrolling:touch]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Buat kata sandi baru</h1>
          <p className="text-sm text-muted-foreground">
            Masukkan kata sandi baru untuk akun Anda.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <form action={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Kata sandi baru</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    placeholder="Min. 6 karakter"
                    className="pr-10"
                    disabled={isPending}
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
              <div className="space-y-2">
                <Label htmlFor="confirm">Konfirmasi kata sandi</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder="Ulangi kata sandi baru"
                  disabled={isPending}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Menyimpan…" : "Simpan kata sandi baru"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
