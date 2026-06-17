"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Home,
  MapPin,
  MessageCircle,
  Smartphone,
  Flag,
  ShoppingCart,
  Utensils,
  Globe,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CHANNEL_PRESETS,
  type OrderChannelConfig,
  type OrderChannelKind,
} from "@/lib/types";
import { createChannel, updateChannel, toggleChannelActive, deleteChannel } from "./actions";
import { Toggle } from "./toggle";

type IconStyle = { icon: React.ComponentType<{ className?: string }>; bg: string };

const CHANNEL_ICONS: Record<string, IconStyle> = {
  "dine-in": { icon: Home, bg: "bg-zinc-900" },
  "dine_in": { icon: Home, bg: "bg-zinc-900" },
  "dinein": { icon: Home, bg: "bg-zinc-900" },
  takeaway: { icon: MapPin, bg: "bg-zinc-500" },
  whatsapp: { icon: MessageCircle, bg: "bg-emerald-500" },
  gofood: { icon: Smartphone, bg: "bg-emerald-600" },
  grabfood: { icon: Flag, bg: "bg-emerald-600" },
  shopeefood: { icon: ShoppingCart, bg: "bg-orange-500" },
};

function iconForChannel(channel: OrderChannelConfig): IconStyle {
  const key = channel.name.toLowerCase().replace(/\s+/g, "");
  if (CHANNEL_ICONS[key]) return CHANNEL_ICONS[key];
  if (CHANNEL_ICONS[channel.id]) return CHANNEL_ICONS[channel.id];
  if (channel.kind === "direct") return { icon: Utensils, bg: "bg-zinc-700" };
  if (channel.kind === "online") return { icon: Globe, bg: "bg-sky-600" };
  return { icon: Radio, bg: "bg-slate-500" };
}

function ChannelForm({
  channel,
  onSuccess,
}: {
  channel?: OrderChannelConfig;
  onSuccess: () => void;
}) {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<OrderChannelKind>(channel?.kind ?? "online");
  const [name, setName] = useState(channel?.name ?? "");

  const availablePresets = useMemo(() => CHANNEL_PRESETS[kind], [kind]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("kind", kind);
    fd.set("name", name);
    start(async () => {
      const res = channel ? await updateChannel(fd) : await createChannel(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(channel ? "Saluran diperbarui" : "Saluran ditambahkan");
      onSuccess();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {channel && <input type="hidden" name="id" value={channel.id} />}

      <div className="space-y-1.5">
        <Label>Tipe</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["direct", "online"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                kind === k
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {k === "direct" ? "Direct" : "Online"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="channel-name">
          Nama saluran <span className="text-destructive">*</span>
        </Label>
        <Input
          id="channel-name"
          name="name"
          placeholder={kind === "direct" ? "mis. Dine-in" : "mis. GoFood"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {availablePresets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {availablePresets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setName(p)}
                className="text-xs rounded-full border px-2 py-0.5 hover:bg-muted transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Menyimpan…" : channel ? "Simpan perubahan" : "Tambah saluran"}
      </Button>
    </form>
  );
}

function ChannelRow({ channel }: { channel: OrderChannelConfig }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const { icon: Icon, bg } = iconForChannel(channel);

  function toggle() {
    start(async () => {
      const res = await toggleChannelActive(channel.id, !channel.is_active);
      if (!res.ok) toast.error(res.error);
      else toast.success(channel.is_active ? "Saluran dinonaktifkan" : "Saluran diaktifkan");
    });
  }

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    start(async () => {
      const res = await deleteChannel(channel.id);
      if (!res.ok) {
        toast.error(res.error);
        setConfirmDelete(false);
      } else {
        toast.success("Saluran dihapus");
      }
    });
  }

  const channelDesc = channelDescription(channel);

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <div className={`h-10 w-10 rounded-lg ${bg} text-white grid place-items-center shrink-0`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{channel.name}</div>
        {channelDesc && (
          <div className="text-xs text-muted-foreground truncate">{channelDesc}</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Toggle
          checked={channel.is_active}
          onChange={toggle}
          disabled={pending}
          ariaLabel={channel.is_active ? "Nonaktifkan" : "Aktifkan"}
        />
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger render={<Button size="icon" variant="ghost" aria-label="Edit" />}>
            <Pencil className="size-4" />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit saluran</DialogTitle>
            </DialogHeader>
            <ChannelForm channel={channel} onSuccess={() => setEditOpen(false)} />
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
      </div>
    </div>
  );
}

function channelDescription(channel: OrderChannelConfig): string | null {
  const lower = channel.name.toLowerCase();
  if (lower.includes("dine")) return "Makan di tempat";
  if (lower.includes("takeaway") || lower.includes("bawa pulang")) return "Bawa pulang";
  if (lower.includes("whatsapp")) return "Pesan via chat";
  if (lower.includes("gofood")) return "Gojek delivery";
  if (lower.includes("grab")) return "Grab delivery";
  if (lower.includes("shopee")) return "Shopee delivery";
  if (lower.includes("tiktok")) return "TikTok Shop";
  if (channel.kind === "direct") return "Pesanan langsung";
  if (channel.kind === "online") return "Pesanan online";
  return null;
}

const GROUP_LABEL: Record<"direct" | "online" | "uncategorized", string> = {
  direct: "Direct",
  online: "Online",
  uncategorized: "Belum dikelompokkan",
};

export function ChannelsManager({ channels }: { channels: OrderChannelConfig[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  const groups = useMemo(() => {
    const direct: OrderChannelConfig[] = [];
    const online: OrderChannelConfig[] = [];
    const uncategorized: OrderChannelConfig[] = [];
    for (const ch of channels) {
      if (ch.kind === "direct") direct.push(ch);
      else if (ch.kind === "online") online.push(ch);
      else uncategorized.push(ch);
    }
    return { direct, online, uncategorized };
  }, [channels]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="size-4 mr-2" />
            Tambah saluran
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah saluran baru</DialogTitle>
            </DialogHeader>
            <ChannelForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {channels.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          Belum ada saluran. Klik &quot;Tambah saluran&quot; untuk memulai.
        </Card>
      ) : (
        (["direct", "online", "uncategorized"] as const).map((kind) => {
          const list = groups[kind];
          if (list.length === 0) return null;
          return (
            <div key={kind} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {GROUP_LABEL[kind]}
              </div>
              <div className="space-y-2">
                {list.map((ch) => (
                  <ChannelRow key={ch.id} channel={ch} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
