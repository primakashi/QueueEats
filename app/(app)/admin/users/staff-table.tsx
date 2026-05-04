"use client";

import { useTransition } from "react";
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
import { updateStaffRole } from "@/app/(app)/admin/actions";
import type { Profile, UserRole } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const ROLES: UserRole[] = ["waiter", "kitchen", "cashier", "admin"];

export function StaffTable({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function changeRole(id: string, role: UserRole) {
    start(async () => {
      const res = await updateStaffRole(id, role);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Role updated");
      router.refresh();
    });
  }

  if (profiles.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No staff accounts yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="hidden sm:table-cell">Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {profiles.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">{p.full_name}</TableCell>
            <TableCell>
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
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
