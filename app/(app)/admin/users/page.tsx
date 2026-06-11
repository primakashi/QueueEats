import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { StaffTable } from "./staff-table";

export default async function StaffPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Staf"
        description="Kelola akun dan peran staf"
      />
      <StaffTable profiles={(data ?? []) as Profile[]} />
    </div>
  );
}
