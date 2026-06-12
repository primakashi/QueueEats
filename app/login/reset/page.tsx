"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { requestPasswordReset } from "./actions";

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6 bg-muted/30 [-webkit-overflow-scrolling:touch]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Lupa kata sandi?</h1>
          <p className="text-sm text-muted-foreground">
            Masukkan email akun Anda dan kami akan kirimkan link reset.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {sent ? (
              <div className="space-y-4">
                <p className="text-sm text-center">
                  Jika email terdaftar, link reset kata sandi sudah dikirim. Cek kotak masuk Anda.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Kembali ke halaman masuk
                  </Button>
                </Link>
              </div>
            ) : (
              <form action={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="staf@restoran.com"
                    disabled={isPending}
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? "Mengirim…" : "Kirim link reset"}
                </Button>
                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Kembali ke halaman masuk
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
