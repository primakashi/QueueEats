"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { queueStatusColor } from "@/lib/status";
import {
  QUEUE_STATUS_LABEL_ID,
  type QueueEntryStatus,
  type QueueNotificationState,
} from "@/lib/types";
import { minutesAgo } from "@/lib/format";

type HostQueueEntry = {
  id: string;
  token: string;
  name: string;
  party_size: number;
  phone: string | null;
  status: QueueEntryStatus;
  notification_state: QueueNotificationState;
  pending_wa_url: string | null;
  created_at: string;
  queue_number: number;
  position: number;
};

type QueueListResponse = {
  entries: HostQueueEntry[];
  restaurant_name: string;
};

export function HostClient({
  restaurantName,
  initialEntries,
}: {
  restaurantName: string;
  initialEntries: HostQueueEntry[];
}) {
  const [entries, setEntries] = useState<HostQueueEntry[]>(initialEntries);
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seatDialogOpen, setSeatDialogOpen] = useState(false);
  const [seatTarget, setSeatTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [tableNumber, setTableNumber] = useState("");

  const topWaitingId = useMemo(
    () => entries.find((entry) => entry.status === "waiting")?.id ?? null,
    [entries],
  );

  const load = useCallback(async () => {
    setRefreshing(true);
    const res = await fetch("/api/queue/list", { cache: "no-store" });
    const json = (await res.json()) as QueueListResponse & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Gagal memuat antrean");
      setRefreshing(false);
      return;
    }
    setError(null);
    setEntries(json.entries);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  async function addWalkIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          party_size: partySize,
          phone: phone.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Gagal menambah antrean");
        return;
      }
      setName("");
      setPartySize(2);
      setPhone("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(id: string, action: string, body?: object) {
    setBusyId(id + action);
    setError(null);
    try {
      const res = await fetch(`/api/queue/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Aksi gagal");
        return false;
      }
      await load();
      return true;
    } finally {
      setBusyId(null);
    }
  }

  function openSeatDialog(entry: HostQueueEntry) {
    setSeatTarget({ id: entry.id, name: entry.name });
    setTableNumber("");
    setError(null);
    setSeatDialogOpen(true);
  }

  async function confirmSeat() {
    if (!seatTarget) return;
    const table = tableNumber.trim();
    if (!table) {
      setError("Nomor meja wajib diisi");
      return;
    }
    const ok = await runAction(seatTarget.id, "seat", { table_number: table });
    if (!ok) return;
    setSeatDialogOpen(false);
    setSeatTarget(null);
    setTableNumber("");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel host</h1>
        <p className="text-sm text-muted-foreground">
          Kelola antrean pelanggan untuk {restaurantName}
        </p>
        {refreshing && (
          <p className="text-xs text-muted-foreground mt-1">Memperbarui antrean...</p>
        )}
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="font-medium mb-6">Tambah walk-in</h2>
        <form className="grid gap-5 sm:grid-cols-4" onSubmit={addWalkIn}>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="walkin-name">Nama</Label>
            <Input
              id="walkin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama pelanggan"
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="walkin-size">Jumlah orang</Label>
            <Input
              id="walkin-size"
              type="number"
              min={1}
              max={20}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="walkin-phone">WhatsApp</Label>
            <Input
              id="walkin-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="62/0..."
              inputMode="numeric"
              disabled={submitting}
            />
          </div>
          <div className="sm:col-span-4 pt-1">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menambahkan..." : "Tambah ke antrean"}
            </Button>
          </div>
        </form>
      </Card>

      {error && (
        <Card className="p-3 text-sm text-red-700 bg-red-50 border-red-200">
          {error}
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="text-left px-3 py-2">No</th>
                <th className="text-left px-3 py-2">Nama</th>
                <th className="text-left px-3 py-2">Orang</th>
                <th className="text-left px-3 py-2">WA</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Gabung</th>
                <th className="text-left px-3 py-2">Posisi</th>
                <th className="text-left px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b align-top">
                  <td className="px-3 py-2 tabular-nums">#{entry.queue_number}</td>
                  <td className="px-3 py-2 font-medium">{entry.name}</td>
                  <td className="px-3 py-2">{entry.party_size}</td>
                  <td className="px-3 py-2">{entry.phone ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Badge className={queueStatusColor(entry.status)}>
                      {QUEUE_STATUS_LABEL_ID[entry.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{minutesAgo(entry.created_at)}m</td>
                  <td className="px-3 py-2 tabular-nums">
                    {entry.position > 0 ? `#${entry.position}` : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {entry.status === "waiting" && entry.id === topWaitingId && (
                        <Button
                          size="sm"
                          disabled={busyId === entry.id + "call"}
                          onClick={() => void runAction(entry.id, "call")}
                        >
                          {busyId === entry.id + "call" ? "Memanggil..." : "Panggil berikutnya"}
                        </Button>
                      )}
                      {entry.status === "called" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === entry.id + "seat"}
                          onClick={() => openSeatDialog(entry)}
                        >
                          {busyId === entry.id + "seat" ? "Mencatat..." : "Sudah duduk"}
                        </Button>
                      )}
                      {entry.status === "called" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === entry.id + "no-show"}
                          onClick={() => void runAction(entry.id, "no-show")}
                        >
                          {busyId === entry.id + "no-show" ? "Menandai..." : "Tidak hadir"}
                        </Button>
                      )}
                      {entry.status === "waiting" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === entry.id + "cancel-by-host"}
                          onClick={() => void runAction(entry.id, "cancel-by-host")}
                        >
                          {busyId === entry.id + "cancel-by-host" ? "Membatalkan..." : "Batalkan"}
                        </Button>
                      )}
                      {entry.pending_wa_url && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === entry.id + "wa-sent"}
                          onClick={async () => {
                            window.open(entry.pending_wa_url!, "_blank", "noopener,noreferrer");
                            await runAction(entry.id, "wa-sent");
                          }}
                        >
                          {busyId === entry.id + "wa-sent" ? "Mengirim..." : "Kirim WA"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    Tidak ada antrean aktif.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={seatDialogOpen} onOpenChange={setSeatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tandai sudah duduk</DialogTitle>
            <DialogDescription>
              Masukkan nomor meja untuk{" "}
              <span className="font-medium text-foreground">
                {seatTarget?.name ?? "tamu ini"}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="seat-table-number">Nomor meja</Label>
            <Input
              id="seat-table-number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="mis. 5"
              disabled={!!(seatTarget && busyId === seatTarget.id + "seat")}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSeatDialogOpen(false)}
              disabled={!!(seatTarget && busyId === seatTarget.id + "seat")}
            >
              Batal
            </Button>
            <Button
              onClick={() => void confirmSeat()}
              disabled={!!(seatTarget && busyId === seatTarget.id + "seat")}
            >
              {seatTarget && busyId === seatTarget.id + "seat"
                ? "Mencatat..."
                : "Konfirmasi duduk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
