"use client";

import { useState, useTransition } from "react";
import { Archive, Building2, CalendarRange, MapPin, Plus, RotateCcw, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Outlet, UserRole } from "@/lib/types";
import { archiveOutlet, createOutlet, restoreOutlet, updateOutlet } from "./actions";

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function OutletForm({
  outlet,
  onSuccess,
}: {
  outlet?: Outlet;
  onSuccess: () => void;
}) {
  const [pending, start] = useTransition();
  const [isTemp, setIsTemp] = useState(outlet?.is_temporary ?? false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("is_temporary", isTemp ? "true" : "false");
    start(async () => {
      const res = outlet ? await updateOutlet(fd) : await createOutlet(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(outlet ? "Outlet diperbarui" : "Outlet dibuat");
      onSuccess();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {outlet && <input type="hidden" name="id" value={outlet.id} />}
      <div className="space-y-1.5">
        <Label htmlFor="outlet-name">Nama outlet <span className="text-destructive">*</span></Label>
        <Input
          id="outlet-name"
          name="name"
          placeholder="Mis. Outlet Radio Dalam"
          defaultValue={outlet?.name}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="outlet-location">Lokasi</Label>
        <Input
          id="outlet-location"
          name="location"
          placeholder="Mis. Jl. Radio Dalam No. 5"
          defaultValue={outlet?.location ?? ""}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={isTemp}
          onClick={() => setIsTemp((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            isTemp ? "bg-primary" : "bg-input"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
              isTemp ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <Label className="cursor-pointer select-none" onClick={() => setIsTemp((v) => !v)}>
          Outlet sementara (festival/pop-up)
        </Label>
      </div>
      {isTemp && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="outlet-from">Aktif dari <span className="text-destructive">*</span></Label>
            <Input
              id="outlet-from"
              name="active_from"
              type="date"
              defaultValue={outlet?.active_from ?? ""}
              required={isTemp}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outlet-until">Aktif sampai</Label>
            <Input
              id="outlet-until"
              name="active_until"
              type="date"
              defaultValue={outlet?.active_until ?? ""}
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="outlet-tax">Pajak (%)</Label>
          <Input
            id="outlet-tax"
            name="tax_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="0"
            defaultValue={outlet ? String(((outlet.tax_rate ?? 0) * 100).toFixed(2)) : "0"}
          />
          <p className="text-xs text-muted-foreground">Mis. 10 untuk PPN 10%</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="outlet-service">Biaya layanan (%)</Label>
          <Input
            id="outlet-service"
            name="service_charge_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="0"
            defaultValue={outlet ? String(((outlet.service_charge_rate ?? 0) * 100).toFixed(2)) : "0"}
          />
          <p className="text-xs text-muted-foreground">Mis. 5 untuk service 5%</p>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Menyimpan…" : outlet ? "Simpan perubahan" : "Buat outlet"}
      </Button>
    </form>
  );
}

function OutletCard({ outlet, userRole }: { outlet: Outlet; userRole: UserRole }) {
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);

  function toggle() {
    start(async () => {
      const res = outlet.is_archived
        ? await restoreOutlet(outlet.id)
        : await archiveOutlet(outlet.id);
      if (!res.ok) toast.error(res.error);
      else toast.success(outlet.is_archived ? "Outlet dipulihkan" : "Outlet diarsipkan");
    });
  }

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${outlet.is_archived ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-medium truncate">{outlet.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {outlet.is_temporary && (
            <Badge variant="secondary">
              <CalendarRange className="size-3 mr-1" />
              Sementara
            </Badge>
          )}
          {outlet.is_archived && (
            <Badge variant="outline">Diarsipkan</Badge>
          )}
        </div>
      </div>

      {outlet.location && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span>{outlet.location}</span>
        </div>
      )}

      {outlet.is_temporary && (outlet.active_from || outlet.active_until) && (
        <div className="text-xs text-muted-foreground">
          {formatDate(outlet.active_from)} — {outlet.active_until ? formatDate(outlet.active_until) : "tidak ada batas"}
        </div>
      )}

      {((outlet.tax_rate ?? 0) > 0 || (outlet.service_charge_rate ?? 0) > 0) && (
        <div className="text-xs text-muted-foreground flex gap-3">
          {(outlet.tax_rate ?? 0) > 0 && (
            <span>Pajak {((outlet.tax_rate ?? 0) * 100).toFixed(2).replace(/\.?0+$/, "")}%</span>
          )}
          {(outlet.service_charge_rate ?? 0) > 0 && (
            <span>Layanan {((outlet.service_charge_rate ?? 0) * 100).toFixed(2).replace(/\.?0+$/, "")}%</span>
          )}
        </div>
      )}

      <Separator />

      <div className="flex gap-2">
        {(userRole === "admin" || userRole === "owner") && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" className="flex-1" />}>
              Edit
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit outlet</DialogTitle>
              </DialogHeader>
              <OutletForm outlet={outlet} onSuccess={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>
        )}

        {userRole === "owner" && (
          <Button
            size="sm"
            variant="outline"
            onClick={toggle}
            disabled={pending}
            aria-busy={pending}
            className="flex-1"
          >
            {outlet.is_archived ? (
              <><RotateCcw className="size-3.5 mr-1" /> Pulihkan</>
            ) : (
              <><Archive className="size-3.5 mr-1" /> Arsipkan</>
            )}
          </Button>
        )}
      </div>

      <a
        href={`/admin/sales?outlet=${outlet.id}`}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <BarChart3 className="size-3.5" />
        Lihat penjualan
      </a>
    </div>
  );
}

export function OutletsManager({ outlets, userRole }: { outlets: Outlet[]; userRole: UserRole }) {
  const [createOpen, setCreateOpen] = useState(false);
  const active = outlets.filter((o) => !o.is_archived);
  const archived = outlets.filter((o) => o.is_archived);

  return (
    <div className="space-y-6">
      {(userRole === "admin" || userRole === "owner") && (
        <div className="flex justify-end">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="size-4 mr-2" />
              Tambah outlet
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah outlet baru</DialogTitle>
              </DialogHeader>
              <OutletForm onSuccess={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {active.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          Belum ada outlet.{userRole === "admin" || userRole === "owner" ? ' Klik "Tambah outlet" untuk memulai.' : ""}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((o) => (
            <OutletCard key={o.id} outlet={o} userRole={userRole} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Diarsipkan ({archived.length})</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {archived.map((o) => (
              <OutletCard key={o.id} outlet={o} userRole={userRole} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
