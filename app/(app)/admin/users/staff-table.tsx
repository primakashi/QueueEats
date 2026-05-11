"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Spinner } from "@/components/ui/spinner";
import { updateStaffRole } from "@/app/(app)/admin/actions";
import type { Profile, UserRole } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const ROLES: UserRole[] = ["waiter", "kitchen", "cashier", "admin"];

export function StaffTable({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

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

  if (profiles.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Belum ada akun staf.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead>Peran</TableHead>
          <TableHead className="hidden sm:table-cell">Bergabung</TableHead>
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
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {busyId === p.id && (
                  <Spinner className="text-muted-foreground" />
                )}
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
              {formatDateTime(p.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
