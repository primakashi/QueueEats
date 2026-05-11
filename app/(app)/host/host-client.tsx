"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
import { cn } from "@/lib/utils";
import { FloorPlan, type FloorTableState } from "./floor-plan";
import { FLOOR_TABLES, type FloorTable } from "@/lib/floor-plan";

type HostQueueEntry = {
  id: string;
  token: string;
  name: string;
  party_size: number;
  phone: string | null;
  status: QueueEntryStatus;
  notification_state: QueueNotificationState;
  pending_wa_url: string | null;
  waiting_in_store: boolean;
  party_has_infant: boolean;
  party_has_elderly: boolean;
  party_has_child: boolean;
  assigned_table: string | null;
  created_at: string;
  queue_number: number;
  position: number;
};

type QueueListResponse = {
  entries: HostQueueEntry[];
  restaurant_name: string;
  tables_needing_cleanup: string[];
};

export function HostClient({
  restaurantName,
  initialEntries,
  initialTablesNeedingCleanup,
}: {
  restaurantName: string;
  initialEntries: HostQueueEntry[];
  initialTablesNeedingCleanup: string[];
}) {
  const [entries, setEntries] = useState<HostQueueEntry[]>(initialEntries);
  const [tablesNeedingCleanup, setTablesNeedingCleanup] = useState<string[]>(
    initialTablesNeedingCleanup,
  );
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [partyHasInfant, setPartyHasInfant] = useState(false);
  const [partyHasElderly, setPartyHasElderly] = useState(false);
  const [partyHasChild, setPartyHasChild] = useState(false);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyTableId, setBusyTableId] = useState<string | null>(null);

  // Click-free-table flow: pick which called party to seat (if multiple).
  const [pickPartyOpen, setPickPartyOpen] = useState(false);
  const [pickPartyTable, setPickPartyTable] = useState<FloorTable | null>(null);

  // Click-occupied-table flow: confirm freeing the table.
  const [freeTableOpen, setFreeTableOpen] = useState(false);
  const [freeTableTarget, setFreeTableTarget] = useState<{
    table: FloorTable;
    entryId: string;
    name: string;
    needsCleanup: boolean;
  } | null>(null);

  const floorPlanSectionRef = useRef<HTMLDivElement>(null);
  const floorPlanScrollBusyRef = useRef(false);
  const [floorPlanScrollPending, setFloorPlanScrollPending] = useState(false);
  const [floorPlanSpotlight, setFloorPlanSpotlight] = useState(false);

  const scrollToFloorPlan = useCallback(() => {
    if (floorPlanScrollBusyRef.current) return;
    const el = floorPlanSectionRef.current;
    if (!el) return;

    floorPlanScrollBusyRef.current = true;
    setFloorPlanScrollPending(true);
    const toastId = toast.loading("Menuju denah meja…");

    const marginTopPx = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const rect = el.getBoundingClientRect();
    const docScrollY = window.scrollY ?? document.documentElement.scrollTop;
    const targetY = Math.max(0, rect.top + docScrollY - marginTopPx);
    window.scrollTo({ top: targetY, behavior: "smooth" });

    let finished = false;
    let fallbackId: number | undefined;
    let spotlightClearId: number | undefined;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (fallbackId !== undefined) window.clearTimeout(fallbackId);

      toast.dismiss(toastId);
      requestAnimationFrame(() => {
        el.focus({ preventScroll: true });
        setFloorPlanSpotlight(true);
        if (spotlightClearId !== undefined) window.clearTimeout(spotlightClearId);
        spotlightClearId = window.setTimeout(() => setFloorPlanSpotlight(false), 2200);
      });
      floorPlanScrollBusyRef.current = false;
      setFloorPlanScrollPending(false);
    };

    const onScrollEnd = () => finish();

    window.addEventListener("scrollend", onScrollEnd, { once: true });
    document.documentElement.addEventListener("scrollend", onScrollEnd, {
      once: true,
    });
    fallbackId = window.setTimeout(finish, 1200);
  }, []);

  const calledEntries = useMemo(
    () => entries.filter((e) => e.status === "called"),
    [entries],
  );

  const queueEntries = useMemo(
    () => entries.filter((e) => e.status === "waiting" || e.status === "called"),
    [entries],
  );

  const seatedEntries = useMemo(
    () => entries.filter((e) => e.status === "seated"),
    [entries],
  );

  const topWaitingId = useMemo(
    () => entries.find((entry) => entry.status === "waiting")?.id ?? null,
    [entries],
  );

  const tableState = useMemo<Record<string, FloorTableState>>(() => {
    const cleanupSet = new Set(tablesNeedingCleanup);
    const state: Record<string, FloorTableState> = {};
    for (const table of FLOOR_TABLES) {
      state[table.id] = { kind: "free" };
    }
    for (const entry of seatedEntries) {
      const tableId = entry.assigned_table;
      if (!tableId) continue;
      state[tableId] = {
        kind: "occupied",
        entryId: entry.id,
        name: entry.name,
        partySize: entry.party_size,
        needsCleanup: cleanupSet.has(tableId),
      };
    }
    return state;
  }, [seatedEntries, tablesNeedingCleanup]);

  // The party that the floor plan should highlight tables for.
  const pendingCalledParty = useMemo(() => {
    if (calledEntries.length === 0) return null;
    // Hint the smallest party_size so the user sees which seat-counts fit.
    const min = Math.min(...calledEntries.map((e) => e.party_size));
    return { partySize: min };
  }, [calledEntries]);

  const load = useCallback(async () => {
    setRefreshing(true);
    const res = await fetch("/api/queue/host-list", { cache: "no-store" });
    const json = (await res.json()) as QueueListResponse & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Gagal memuat antrian");
      setRefreshing(false);
      return;
    }
    setError(null);
    setEntries(json.entries);
    setTablesNeedingCleanup(json.tables_needing_cleanup ?? []);
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
          waiting_in_store: true,
          party_has_infant: partyHasInfant,
          party_has_elderly: partyHasElderly,
          party_has_child: partyHasChild,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Gagal menambah antrian");
        return;
      }
      setName("");
      setPartySize(2);
      setPartyHasInfant(false);
      setPartyHasElderly(false);
      setPartyHasChild(false);
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

  async function seatAtTable(entryId: string, table: FloorTable) {
    setBusyTableId(table.id);
    setError(null);
    try {
      const res = await fetch(`/api/queue/${entryId}/seat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: table.id }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Gagal mendudukkan di ${table.label}`);
        return false;
      }
      await load();
      return true;
    } finally {
      setBusyTableId(null);
    }
  }

  async function completeAtTable(entryId: string, table: FloorTable) {
    setBusyTableId(table.id);
    setError(null);
    try {
      const res = await fetch(`/api/queue/${entryId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Gagal mengosongkan ${table.label}`);
        return false;
      }
      await load();
      return true;
    } finally {
      setBusyTableId(null);
    }
  }

  function handleTableClick(table: FloorTable, state: FloorTableState) {
    setError(null);
    if (state.kind === "occupied") {
      setFreeTableTarget({
        table,
        entryId: state.entryId,
        name: state.name,
        needsCleanup: state.needsCleanup,
      });
      setFreeTableOpen(true);
      return;
    }

    if (calledEntries.length === 0) {
      setError(
        "Belum ada tamu yang dipanggil. Klik “Panggil berikutnya” pada antrian dulu.",
      );
      return;
    }

    if (calledEntries.length === 1) {
      void seatAtTable(calledEntries[0].id, table);
      return;
    }

    setPickPartyTable(table);
    setPickPartyOpen(true);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6 pb-10 sm:pb-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel host</h1>
        <p className="text-sm text-muted-foreground">
          Kelola antrian pelanggan untuk {restaurantName}
        </p>
        {refreshing && (
          <p className="text-xs text-muted-foreground mt-1">Memperbarui antrian...</p>
        )}
      </div>

      {error && (
        <Card className="p-3 text-sm text-red-700 bg-red-50 border-red-200">
          {error}
        </Card>
      )}

      <div
        ref={floorPlanSectionRef}
        id="host-floor-plan-anchor"
        tabIndex={-1}
        role="region"
        aria-label="Denah meja"
        className={cn(
          "scroll-mt-20 rounded-xl outline-none transition-shadow duration-300 lg:scroll-mt-6",
          "focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
          floorPlanSpotlight &&
            "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-sm",
        )}
      >
        <Card className="p-5 sm:p-6">
          <h2 className="font-medium mb-4">Denah meja</h2>
          <FloorPlan
            tableState={tableState}
            selectedTableId={null}
            pendingCalledParty={pendingCalledParty}
            busyTableId={busyTableId}
            onTableClick={handleTableClick}
          />
        </Card>
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
          <div className="sm:col-span-4 grid gap-3 sm:grid-cols-3 rounded-lg border border-border/60 px-3 py-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={partyHasInfant}
                onChange={(e) => setPartyHasInfant(e.target.checked)}
                disabled={submitting}
                className="size-4 rounded border-input"
              />
              Bayi / balita
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={partyHasElderly}
                onChange={(e) => setPartyHasElderly(e.target.checked)}
                disabled={submitting}
                className="size-4 rounded border-input"
              />
              Lansia
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={partyHasChild}
                onChange={(e) => setPartyHasChild(e.target.checked)}
                disabled={submitting}
                className="size-4 rounded border-input"
              />
              Anak
            </label>
          </div>
          <div className="sm:col-span-4 pt-1">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menambahkan..." : "Tambah ke antrian"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium">Antrian aktif</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="text-left px-3 py-2">No</th>
                <th className="text-left px-3 py-2">Nama</th>
                <th className="text-left px-3 py-2">Orang</th>
                <th className="text-left px-3 py-2">Di lokasi</th>
                <th className="text-left px-3 py-2">WA</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Gabung</th>
                <th className="text-left px-3 py-2">Posisi</th>
                <th className="text-left px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {queueEntries.map((entry) => (
                <tr key={entry.id} className="border-b align-top">
                  <td className="px-3 py-2 tabular-nums">#{entry.queue_number}</td>
                  <td className="px-3 py-2 font-medium">{entry.name}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium tabular-nums">{entry.party_size}</div>
                    <PartyHints entry={entry} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-2 rounded-lg border px-2 py-2 sm:px-2.5">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Status terbaru
                      </div>
                      <div className="text-sm font-bold">
                        {entry.waiting_in_store ? "Di lokasi" : "Belum di lokasi"}
                      </div>
                      {(entry.status === "waiting" || entry.status === "called") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs font-medium"
                          disabled={busyId === entry.id + "waiting-in-store"}
                          onClick={() =>
                            void runAction(entry.id, "waiting-in-store", {
                              waiting_in_store: !entry.waiting_in_store,
                            })
                          }
                        >
                          {busyId === entry.id + "waiting-in-store"
                            ? "Menyimpan..."
                            : entry.waiting_in_store
                              ? "Tandai belum di lokasi"
                              : "Tandai di lokasi"}
                        </Button>
                      )}
                    </div>
                  </td>
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
                        <span className="text-xs text-muted-foreground italic">
                          Klik meja kosong di denah
                        </span>
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
              {queueEntries.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Tidak ada antrian aktif.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pick which called party to seat at the chosen table */}
      <Dialog open={pickPartyOpen} onOpenChange={setPickPartyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pilih tamu untuk meja {pickPartyTable?.label}</DialogTitle>
            <DialogDescription>
              Beberapa tamu sedang dipanggil. Pilih siapa yang akan didudukkan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {calledEntries.map((entry) => {
              const tooBig =
                pickPartyTable !== null && entry.party_size > pickPartyTable.seats;
              return (
                <Button
                  key={entry.id}
                  variant="outline"
                  className="justify-between h-auto py-3"
                  disabled={!pickPartyTable || busyTableId === pickPartyTable.id}
                  onClick={async () => {
                    if (!pickPartyTable) return;
                    const ok = await seatAtTable(entry.id, pickPartyTable);
                    if (ok) {
                      setPickPartyOpen(false);
                      setPickPartyTable(null);
                    }
                  }}
                >
                  <span className="text-left">
                    <div className="font-medium">{entry.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.party_size} orang
                      {tooBig && (
                        <span className="ml-2 text-amber-700">
                          (lebih besar dari kapasitas meja)
                        </span>
                      )}
                    </div>
                  </span>
                  <span className="text-xs text-muted-foreground">#{entry.queue_number}</span>
                </Button>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPickPartyOpen(false);
                setPickPartyTable(null);
              }}
            >
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm freeing an occupied table */}
      <Dialog open={freeTableOpen} onOpenChange={setFreeTableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Kosongkan meja {freeTableTarget?.table.label}?
            </DialogTitle>
            <DialogDescription>
              {freeTableTarget?.needsCleanup ? (
                <>
                  Pesanan untuk meja ini sudah dibayar. Tandai{" "}
                  <span className="font-medium text-foreground">
                    {freeTableTarget?.name}
                  </span>{" "}
                  selesai dan kosongkan meja?
                </>
              ) : (
                <>
                  Tandai{" "}
                  <span className="font-medium text-foreground">
                    {freeTableTarget?.name}
                  </span>{" "}
                  selesai dan kosongkan meja?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFreeTableOpen(false);
                setFreeTableTarget(null);
              }}
              disabled={!!(freeTableTarget && busyTableId === freeTableTarget.table.id)}
            >
              Batal
            </Button>
            <Button
              onClick={async () => {
                if (!freeTableTarget) return;
                const ok = await completeAtTable(
                  freeTableTarget.entryId,
                  freeTableTarget.table,
                );
                if (ok) {
                  setFreeTableOpen(false);
                  setFreeTableTarget(null);
                }
              }}
              disabled={!!(freeTableTarget && busyTableId === freeTableTarget.table.id)}
            >
              {freeTableTarget && busyTableId === freeTableTarget.table.id
                ? "Mengosongkan..."
                : "Kosongkan meja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PartyHints({ entry }: { entry: HostQueueEntry }) {
  const bits: string[] = [];
  if (entry.party_has_infant) bits.push("Bayi");
  if (entry.party_has_elderly) bits.push("Lansia");
  if (entry.party_has_child) bits.push("Anak");
  if (bits.length === 0) return null;
  return <div className="text-xs text-muted-foreground mt-0.5">{bits.join(" · ")}</div>;
}
