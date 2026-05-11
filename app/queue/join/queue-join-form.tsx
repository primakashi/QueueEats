"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CreateResponse = {
  token: string;
  position: number;
};

export function QueueJoinForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [phone, setPhone] = useState("");
  const [partyHasInfant, setPartyHasInfant] = useState(false);
  const [partyHasElderly, setPartyHasElderly] = useState(false);
  const [partyHasChild, setPartyHasChild] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          party_size: Number(partySize),
          phone: phone.trim() || null,
          party_has_infant: partyHasInfant,
          party_has_elderly: partyHasElderly,
          party_has_child: partyHasChild,
        }),
      });
      const json = (await res.json()) as CreateResponse & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Gagal bergabung antrian");
        setLoading(false);
        return;
      }
      router.push(`/queue/${json.token}`);
    } catch {
      setError("Tidak dapat menghubungi server");
      setLoading(false);
    }
  }

  return (
    <Card className="relative overflow-hidden p-6 sm:p-7">
      {loading && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/75 backdrop-blur-[2px]"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-medium px-4 text-center">
            Memproses pendaftaran antrian…
          </p>
          <p className="text-xs text-muted-foreground px-6 text-center">
            Mohon tunggu, jangan tutup halaman ini.
          </p>
        </div>
      )}
      <form className="space-y-5" onSubmit={onSubmit} aria-busy={loading}>
        <div className="space-y-2">
          <Label htmlFor="name">Nama</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama Anda"
            required
            maxLength={80}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="party-size">Jumlah orang</Label>
          <Select
            value={partySize}
            onValueChange={(value) => setPartySize(value ?? "1")}
            disabled={loading}
          >
            <SelectTrigger id="party-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value} orang
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="space-y-3 rounded-lg border border-border/60 px-3 py-3">
          <legend className="text-sm font-medium px-1">Kebutuhan rombongan (opsional)</legend>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={partyHasInfant}
              onChange={(e) => setPartyHasInfant(e.target.checked)}
              disabled={loading}
              className="size-4 rounded border-input"
            />
            Ada bayi / balita
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={partyHasElderly}
              onChange={(e) => setPartyHasElderly(e.target.checked)}
              disabled={loading}
              className="size-4 rounded border-input"
            />
            Ada lansia
          </label>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="phone">Nomor WhatsApp (opsional)</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="contoh: 08123456789"
            inputMode="numeric"
            pattern="^(62|0)[0-9]+$"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Hanya angka, harus diawali 62 atau 0. Kami akan memberi tahu lewat
            WhatsApp.
          </p>
        </div>

        {error && (
          <div className="text-sm rounded-md bg-red-100 text-red-800 px-3 py-2">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full mt-1" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Memproses…
            </>
          ) : (
            "Gabung antrian"
          )}
        </Button>
      </form>
    </Card>
  );
}
