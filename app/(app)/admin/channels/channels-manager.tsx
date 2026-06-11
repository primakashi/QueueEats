"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { OrderChannelConfig } from "@/lib/types";
import { createChannel, updateChannel, toggleChannelActive, deleteChannel } from "./actions";

function ChannelForm({
  channel,
  onSuccess,
}: {
  channel?: OrderChannelConfig;
  onSuccess: () => void;
}) {
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
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
      {!channel && (
        <div className="space-y-1.5">
          <Label htmlFor="channel-id">
            ID saluran <span className="text-destructive">*</span>
          </Label>
          <Input
            id="channel-id"
            name="id"
            placeholder="mis. tokopedia_food"
            required
          />
          <p className="text-xs text-muted-foreground">
            Huruf kecil, angka, dan underscore. Tidak bisa diubah setelah dibuat.
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="channel-name">
          Nama saluran <span className="text-destructive">*</span>
        </Label>
        <Input
          id="channel-name"
          name="name"
          placeholder="mis. TokopediaFood"
          defaultValue={channel?.name}
          required
        />
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

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-medium truncate">{channel.name}</span>
        <span className="text-xs text-muted-foreground font-mono shrink-0">{channel.id}</span>
        {!channel.is_active && <Badge variant="outline">Nonaktif</Badge>}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger render={<Button size="icon" variant="ghost" aria-label="Edit" />}>
            <Pencil className="size-3.5" />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit saluran</DialogTitle>
            </DialogHeader>
            <ChannelForm channel={channel} onSuccess={() => setEditOpen(false)} />
          </DialogContent>
        </Dialog>

        <Button
          size="sm"
          variant="outline"
          onClick={toggle}
          disabled={pending}
          aria-busy={pending}
        >
          {channel.is_active ? "Nonaktifkan" : "Aktifkan"}
        </Button>

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
        {confirmDelete && (
          <span className="text-xs text-destructive">Klik lagi untuk hapus</span>
        )}
      </div>
    </div>
  );
}

export function ChannelsManager({ channels }: { channels: OrderChannelConfig[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
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
          Belum ada saluran. Klik "Tambah saluran" untuk memulai.
        </Card>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => (
            <ChannelRow key={ch.id} channel={ch} />
          ))}
        </div>
      )}
    </div>
  );
}
