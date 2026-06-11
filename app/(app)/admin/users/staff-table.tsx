"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { deleteStaff, inviteStaff, updateStaffRole } from "@/app/(app)/admin/actions";
import type { Profile, UserRole } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const ROLES: UserRole[] = ["waiter", "kitchen", "cashier", "admin", "owner"];

function InviteDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selectedRole, setSelectedRole] = useState<UserRole>("waiter");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await inviteStaff(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Staf berhasil ditambahkan");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelectedRole("waiter"); }}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4 mr-1.5" /> Tambah staf
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah staf baru</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Nama lengkap <span className="text-destructive">*</span></Label>
            <Input id="invite-name" name="full_name" placeholder="Mis. Budi Santoso" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email <span className="text-destructive">*</span></Label>
            <Input id="invite-email" name="email" type="email" placeholder="budi@example.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-password">Kata sandi <span className="text-destructive">*</span></Label>
            <Input id="invite-password" name="password" type="password" placeholder="Min. 6 karakter" required minLength={6} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Peran</Label>
            <Select name="role" value={selectedRole} onValueChange={(v) => setSelectedRole(v as UserRole)}>
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue>{ROLE_LABEL[selectedRole]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
            {pending ? <><Spinner className="mr-2" /> Membuat akun…</> : "Tambah staf"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StaffTable({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function changeRole(id: string, role: UserRole) {
    setBusyId(id);
    start(async () => {
      const res = await updateStaffRole(id, role);
      if (!res.ok) {
        toast.error(res.error);
        setBusyId(null);
        return;
      }
      toast.success("Peran diperbarui");
      setBusyId(null);
      router.refresh();
    });
  }

  function confirmDelete(id: string) {
    setBusyId(id);
    setConfirmDeleteId(null);
    start(async () => {
      const res = await deleteStaff(id);
      if (!res.ok) {
        toast.error(res.error);
        setBusyId(null);
        return;
      }
      toast.success("Akun staf dihapus");
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <InviteDialog />
      </div>
      {profiles.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground border rounded-md">
          Belum ada akun staf.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead className="hidden sm:table-cell">Bergabung</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id} aria-busy={busyId === p.id}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Select
                      value={p.role}
                      onValueChange={(v) => changeRole(p.id, v as UserRole)}
                      disabled={pending}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue>{ROLE_LABEL[p.role]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {busyId === p.id && <Spinner className="text-muted-foreground" />}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {formatDateTime(p.created_at)}
                </TableCell>
                <TableCell>
                  {confirmDeleteId === p.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs px-2"
                        disabled={pending}
                        onClick={() => confirmDelete(p.id)}
                      >
                        Hapus
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Batal
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={pending}
                      onClick={() => setConfirmDeleteId(p.id)}
                      aria-label="Hapus staf"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
