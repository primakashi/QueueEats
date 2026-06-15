"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { onboardRestaurant } from "./actions";

export default function OnboardPage() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await onboardRestaurant(fd);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href="/superadmin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali
        </Link>
        <h1 className="text-xl font-semibold">Onboard Restoran Baru</h1>
        <p className="text-sm text-muted-foreground">Isi data di bawah untuk mendaftarkan restoran baru ke platform.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-6">
            {/* Restaurant */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Data Restoran</h2>
              <div className="space-y-1.5">
                <Label htmlFor="restaurant-name">Nama Restoran <span className="text-destructive">*</span></Label>
                <Input
                  id="restaurant-name"
                  name="restaurant_name"
                  placeholder="Mis. Warung Bu Sari"
                  required
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subscription-end">Langganan Aktif Hingga</Label>
                <Input
                  id="subscription-end"
                  name="subscription_end_date"
                  type="date"
                  disabled={pending}
                />
                <p className="text-xs text-muted-foreground">Kosongkan jika belum ditentukan.</p>
              </div>
            </div>

            <Separator />

            {/* Owner */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Akun Owner</h2>
              <div className="space-y-1.5">
                <Label htmlFor="owner-name">Nama Lengkap <span className="text-destructive">*</span></Label>
                <Input
                  id="owner-name"
                  name="owner_name"
                  placeholder="Mis. Budi Santoso"
                  required
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner-email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="owner-email"
                  name="owner_email"
                  type="email"
                  placeholder="owner@restoran.com"
                  required
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner-password">Kata Sandi Awal <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="owner-password"
                    name="owner_password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 karakter"
                    required
                    minLength={6}
                    disabled={pending}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Owner dapat mengubah kata sandi setelah login pertama.
                </p>
              </div>
            </div>

            <Separator />

            {/* First outlet */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Outlet Pertama</h2>
              <div className="space-y-1.5">
                <Label htmlFor="outlet-name">Nama Outlet <span className="text-destructive">*</span></Label>
                <Input
                  id="outlet-name"
                  name="outlet_name"
                  placeholder="Mis. Cabang Sudirman"
                  required
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="outlet-location">Lokasi</Label>
                <Input
                  id="outlet-location"
                  name="outlet_location"
                  placeholder="Mis. Jl. Sudirman No. 1, Jakarta"
                  disabled={pending}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
              {pending ? "Mendaftarkan restoran…" : "Daftarkan Restoran"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
