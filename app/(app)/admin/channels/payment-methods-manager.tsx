"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  Banknote,
  QrCode,
  ArrowUpFromLine,
  CreditCard,
  Truck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  PaymentMethodConfig,
  PaymentMethodKind,
  PaymentMethodWithProviders,
  PaymentProviderConfig,
} from "@/lib/types";
import {
  createPaymentMethod,
  updatePaymentMethod,
  togglePaymentMethodActive,
  deletePaymentMethod,
  createPaymentProvider,
  updatePaymentProvider,
  togglePaymentProviderActive,
  deletePaymentProvider,
} from "./actions";
import { Toggle } from "./toggle";

type IconMap = Record<string, { icon: React.ComponentType<{ className?: string }>; bg: string }>;

const METHOD_ICONS: IconMap = {
  cash: { icon: Banknote, bg: "bg-emerald-500" },
  qris: { icon: QrCode, bg: "bg-indigo-500" },
  transfer: { icon: ArrowUpFromLine, bg: "bg-sky-500" },
  kartu: { icon: CreditCard, bg: "bg-slate-600" },
  online_delivery: { icon: Truck, bg: "bg-orange-500" },
};

function iconForMethod(m: PaymentMethodConfig) {
  return METHOD_ICONS[m.slug] ?? { icon: Wallet, bg: "bg-zinc-500" };
}

function MethodForm({
  method,
  onSuccess,
}: {
  method?: PaymentMethodConfig;
  onSuccess: () => void;
}) {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<PaymentMethodKind>(method?.kind ?? "simple");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!method) fd.set("kind", kind);
    start(async () => {
      try {
        const res = method ? await updatePaymentMethod(fd) : await createPaymentMethod(fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(method ? "Metode diperbarui" : "Metode ditambahkan");
        onSuccess();
      } catch (err) {
        console.error("[pm] saveMethod threw", err);
        toast.error("Gagal menyimpan metode. Coba lagi.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {method && <input type="hidden" name="id" value={method.id} />}

      {!method && (
        <div className="space-y-1.5">
          <Label>Tipe metode</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["simple", "provider"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`h-auto py-2 px-3 rounded-md border text-sm font-medium transition-colors text-left ${
                  kind === k
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-background hover:bg-muted"
                }`}
              >
                <div className="font-semibold">{k === "simple" ? "Tunggal" : "Bertingkat"}</div>
                <div className={`text-xs ${kind === k ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {k === "simple" ? "Satu metode saja" : "Beberapa provider di bawahnya"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="method-name">Nama metode <span className="text-destructive">*</span></Label>
        <Input id="method-name" name="name" required defaultValue={method?.name ?? ""} placeholder="mis. QRIS" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="method-desc">Deskripsi</Label>
        <Textarea
          id="method-desc"
          name="description"
          defaultValue={method?.description ?? ""}
          placeholder="Penjelasan singkat (opsional)"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="method-color">Warna ikon (hex)</Label>
        <Input id="method-color" name="color" defaultValue={method?.color ?? ""} placeholder="#6366f1" />
      </div>

      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Menyimpan…" : method ? "Simpan perubahan" : "Tambah metode"}
      </Button>
    </form>
  );
}

function ProviderForm({
  methodId,
  provider,
  onSuccess,
}: {
  methodId: string;
  provider?: PaymentProviderConfig;
  onSuccess: () => void;
}) {
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("payment_method_id", methodId);
    start(async () => {
      try {
        const res = provider ? await updatePaymentProvider(fd) : await createPaymentProvider(fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(provider ? "Provider diperbarui" : "Provider ditambahkan");
        onSuccess();
      } catch (err) {
        console.error("[pm] saveProvider threw", err);
        toast.error("Gagal menyimpan provider. Coba lagi.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {provider && <input type="hidden" name="id" value={provider.id} />}
      <div className="space-y-1.5">
        <Label htmlFor="provider-name">Nama provider <span className="text-destructive">*</span></Label>
        <Input id="provider-name" name="name" required defaultValue={provider?.name ?? ""} placeholder="mis. GoPay" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="provider-desc">Keterangan</Label>
        <Input id="provider-desc" name="description" defaultValue={provider?.description ?? ""} placeholder="mis. Gojek" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="provider-color">Warna (hex)</Label>
        <Input id="provider-color" name="color" defaultValue={provider?.color ?? ""} placeholder="#16a34a" />
      </div>
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Menyimpan…" : provider ? "Simpan perubahan" : "Tambah provider"}
      </Button>
    </form>
  );
}

function ProviderRow({
  provider,
  methodActive,
}: {
  provider: PaymentProviderConfig;
  methodActive: boolean;
}) {
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggle() {
    start(async () => {
      try {
        const res = await togglePaymentProviderActive(provider.id, !provider.is_active);
        if (!res.ok) toast.error(res.error);
      } catch (err) {
        console.error("[pm] toggleProvider threw", err);
        toast.error("Gagal mengubah status provider. Coba lagi.");
      }
    });
  }

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    start(async () => {
      try {
        const res = await deletePaymentProvider(provider.id);
        if (!res.ok) {
          toast.error(res.error);
          setConfirmDelete(false);
        } else {
          toast.success("Provider dihapus");
        }
      } catch (err) {
        console.error("[pm] deleteProvider threw", err);
        toast.error("Gagal menghapus provider. Coba lagi.");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="h-7 w-7 rounded-md text-white text-[10px] font-bold grid place-items-center shrink-0 uppercase"
        style={{ background: provider.color ?? "#6e7b4f" }}
      >
        {provider.name.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <span className="text-sm font-medium truncate">{provider.name}</span>
        {provider.description && (
          <span className="text-xs text-muted-foreground truncate">{provider.description}</span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Toggle
          checked={provider.is_active && methodActive}
          onChange={toggle}
          disabled={pending || !methodActive}
          ariaLabel={provider.is_active ? "Nonaktifkan" : "Aktifkan"}
        />
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger render={<Button size="icon" variant="ghost" aria-label="Edit" />}>
            <Pencil className="size-3.5" />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit provider</DialogTitle>
            </DialogHeader>
            <ProviderForm
              methodId={provider.payment_method_id}
              provider={provider}
              onSuccess={() => setEditOpen(false)}
            />
          </DialogContent>
        </Dialog>
        <Button
          size="icon"
          variant="ghost"
          aria-label={confirmDelete ? "Konfirmasi hapus" : "Hapus"}
          className={confirmDelete ? "text-destructive border border-destructive" : "text-destructive hover:text-destructive"}
          onClick={remove}
          disabled={pending}
          aria-busy={pending}
          onBlur={() => setConfirmDelete(false)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function MethodCard({ method }: { method: PaymentMethodWithProviders }) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const { icon: Icon, bg } = iconForMethod(method);
  const hasProviders = method.kind === "provider";

  function toggle() {
    start(async () => {
      try {
        const res = await togglePaymentMethodActive(method.id, !method.is_active);
        if (!res.ok) toast.error(res.error);
      } catch (err) {
        console.error("[pm] toggleMethod threw", err);
        toast.error("Gagal mengubah status metode. Coba lagi.");
      }
    });
  }

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    start(async () => {
      try {
        const res = await deletePaymentMethod(method.id);
        if (!res.ok) {
          toast.error(res.error);
          setConfirmDelete(false);
        } else {
          toast.success("Metode dihapus");
        }
      } catch (err) {
        console.error("[pm] deleteMethod threw", err);
        toast.error("Gagal menghapus metode. Coba lagi.");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`h-10 w-10 rounded-lg ${bg} text-white grid place-items-center shrink-0`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{method.name}</span>
            {hasProviders && (
              <span className="text-[10px] font-medium uppercase tracking-wide rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                {method.providers.length} provider
              </span>
            )}
          </div>
          {method.description && (
            <div className="text-xs text-muted-foreground truncate">{method.description}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Toggle
            checked={method.is_active}
            onChange={toggle}
            disabled={pending}
            ariaLabel={method.is_active ? "Nonaktifkan" : "Aktifkan"}
          />
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger render={<Button size="icon" variant="ghost" aria-label="Edit" />}>
              <Pencil className="size-4" />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit metode</DialogTitle>
              </DialogHeader>
              <MethodForm method={method} onSuccess={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>
          <Button
            size="icon"
            variant="ghost"
            aria-label={confirmDelete ? "Konfirmasi hapus" : "Hapus"}
            className={confirmDelete ? "text-destructive border border-destructive" : "text-destructive hover:text-destructive"}
            onClick={remove}
            disabled={pending}
            aria-busy={pending}
            onBlur={() => setConfirmDelete(false)}
          >
            <Trash2 className="size-4" />
          </Button>
          {hasProviders && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={expanded ? "Tutup provider" : "Lihat provider"}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          )}
        </div>
      </div>

      {hasProviders && expanded && (
        <div className="border-t bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Provider
            </span>
            <Dialog open={addProviderOpen} onOpenChange={setAddProviderOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                <Plus className="size-3.5 mr-1" />
                Tambah
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah provider baru</DialogTitle>
                </DialogHeader>
                <ProviderForm methodId={method.id} onSuccess={() => setAddProviderOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
          {method.providers.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4">
              Belum ada provider. Klik &quot;Tambah&quot; untuk memulai.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {method.providers.map((p) => (
                <ProviderRow key={p.id} provider={p} methodActive={method.is_active} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PaymentMethodsManager({ methods }: { methods: PaymentMethodWithProviders[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="size-4 mr-2" />
            Tambah metode
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah metode baru</DialogTitle>
            </DialogHeader>
            <MethodForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      {methods.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          Belum ada metode pembayaran. Jalankan migrasi 0014 untuk mengisi default, atau klik &quot;Tambah metode&quot;.
        </Card>
      ) : (
        <div className="space-y-2">
          {methods.map((m) => (
            <MethodCard key={m.id} method={m} />
          ))}
        </div>
      )}
    </div>
  );
}
