"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
        }),
      });
      const json = (await res.json()) as CreateResponse & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Gagal bergabung antrean");
        return;
      }
      router.push(`/queue/${json.token}`);
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-7">
      <form className="space-y-5" onSubmit={onSubmit}>
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
          {loading ? "Bergabung antrean..." : "Gabung antrean"}
        </Button>
      </form>
    </Card>
  );
}
