"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, KeyRound } from "lucide-react";
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
import {
  deleteStaff,
  inviteStaff,
  updateStaffRole,
  resetStaffPassword,
} from "@/app/(app)/admin/actions";
import type { Outlet, Profile, UserRole } from "@/lib/types";
import { ROLE_LABEL, HQ_ROLES, BRANCH_ROLES } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const ADMIN_ROLES: UserRole[] = ["waiter", "kitchen", "cashier", "admin", "branch_manager", "finance"];
const OWNER_ROLES: UserRole[] = [...ADMIN_ROLES, "owner"];

function InviteDialog({
  callerRole,
  callerOutletId,
  outlets,
}: {
  callerRole: UserRole;
  callerOutletId: string | null;
  outlets: Pick<Outlet, "id" | "name">[];
}) {
  const availableRoles = callerRole === "owner" ? OWNER_ROLES : ADMIN_ROLES;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selectedRole, setSelectedRole] = useState<UserRole>("waiter");
  const needsOutlet = BRANCH_ROLES.includes(selectedRole);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // branch_manager-callers always assign to their own outlet
    if (callerRole === "branch_manager" && callerOutletId) {
      fd.set("outlet_id", callerOutletId);
    }
    start(async () => {
      try {
        const res = await inviteStaff(fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Staf berhasil ditambahkan");
        setOpen(false);
        setSelectedRole("waiter");
        router.refresh();
      } catch (err) {
        console.error("[staff] inviteStaff threw", err);
        toast.error("Gagal menambah staf. Coba lagi.");
      }
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
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsOutlet && callerRole !== "branch_manager" && (
            <div className="space-y-1.5">
              <Label htmlFor="invite-outlet">Outlet</Label>
              <Select name="outlet_id">
                <SelectTrigger id="invite-outlet" className="w-full">
                  <SelectValue placeholder="Pilih outlet…" />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
            {pending ? <><Spinner className="mr-2" /> Membuat akun…</> : "Tambah staf"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StaffTable({
  profiles,
  outlets,
  callerRole,
  callerOutletId,
  emailMap,
}: {
  profiles: Profile[];
  outlets: Pick<Outlet, "id" | "name">[];
  callerRole: UserRole;
  callerOutletId: string | null;
  emailMap: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{
    name: string;
    emailed: boolean;
    link: string;
  } | null>(null);

  const outletMap = Object.fromEntries(outlets.map((o) => [o.id, o.name]));

  function changeRole(id: string, role: UserRole) {
    setBusyId(id);
    start(async () => {
      try {
        const res = await updateStaffRole(id, role);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Peran diperbarui");
        router.refresh();
      } catch (err) {
        console.error("[staff] updateStaffRole threw", err);
        toast.error("Gagal memperbarui peran. Coba lagi.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleResetPassword(id: string, name: string) {
    setBusyId(id);
    start(async () => {
      try {
        const res = await resetStaffPassword(id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.emailed) {
          toast.success("Link reset kata sandi terkirim via email");
        } else {
          toast.message("Email tidak terkirim — bagikan link manual ke staf");
        }
        setResetResult({ name, emailed: res.emailed, link: res.link });
      } catch (err) {
        console.error("[staff] resetStaffPassword threw", err);
        toast.error("Gagal reset kata sandi. Coba lagi.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function confirmDelete(id: string) {
    setBusyId(id);
    setConfirmDeleteId(null);
    start(async () => {
      try {
        const res = await deleteStaff(id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Akun staf dihapus");
        router.refresh();
      } catch (err) {
        console.error("[staff] deleteStaff threw", err);
        toast.error("Gagal menghapus akun. Coba lagi.");
      } finally {
        setBusyId(null);
      }
    });
  }

  const isHq = HQ_ROLES.includes(callerRole) && !callerOutletId;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <InviteDialog callerRole={callerRole} callerOutletId={callerOutletId} outlets={outlets} />
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
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead>Peran</TableHead>
              {isHq && <TableHead className="hidden md:table-cell">Outlet</TableHead>}
              <TableHead className="hidden lg:table-cell">Bergabung</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id} aria-busy={busyId === p.id}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {emailMap[p.id] ?? "—"}
                </TableCell>
                <TableCell>
                  {p.role === "owner" ? (
                    <span className="text-sm text-muted-foreground">{ROLE_LABEL[p.role]}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Select
                        value={p.role}
                        onValueChange={(v) => changeRole(p.id, v as UserRole)}
                        disabled={pending}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue>{ROLE_LABEL[p.role]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(callerRole === "owner" ? OWNER_ROLES : ADMIN_ROLES).map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {busyId === p.id && <Spinner className="text-muted-foreground" />}
                    </div>
                  )}
                </TableCell>
                {isHq && (
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {p.outlet_id ? (outletMap[p.outlet_id] ?? "—") : <span className="italic">Semua outlet</span>}
                  </TableCell>
                )}
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {formatDateTime(p.created_at)}
                </TableCell>
                <TableCell>
                  {p.role === "owner" ? null : confirmDeleteId === p.id ? (
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
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        disabled={pending}
                        onClick={() => handleResetPassword(p.id, p.full_name)}
                        aria-label="Reset kata sandi"
                        title="Reset kata sandi"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
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
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={!!resetResult}
        onOpenChange={(open) => {
          if (!open) setResetResult(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link reset kata sandi · {resetResult?.name ?? ""}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {resetResult?.emailed
              ? "Email telah dikirim ke staf. Sebagai cadangan, link berikut juga bisa Anda bagikan langsung. Berlaku 1 jam."
              : "Email tidak terkirim (mis. konfigurasi email belum disiapkan). Salin link ini dan bagikan langsung ke staf. Berlaku 1 jam."}
          </p>
          <textarea
            readOnly
            value={resetResult?.link ?? ""}
            className="w-full text-xs font-mono rounded-md border bg-muted/40 px-2 py-2 h-24 resize-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!resetResult) return;
                try {
                  await navigator.clipboard.writeText(resetResult.link);
                  toast.success("Link disalin");
                } catch {
                  toast.error("Gagal menyalin");
                }
              }}
            >
              Salin link
            </Button>
            <Button onClick={() => setResetResult(null)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
