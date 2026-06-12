import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { Outlet, Profile } from "@/lib/types";
import { StaffTable } from "./staff-table";

export default async function StaffPage() {
  const caller = await requireRole(["admin", "owner", "branch_manager"]);
  const supabase = await createClient();

  const profilesQuery = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (caller.outlet_id) {
    profilesQuery.eq("outlet_id", caller.outlet_id);
  }
  const { data: profiles } = await profilesQuery;

  const { data: outlets } = await supabase
    .from("outlets")
    .select("id, name")
    .eq("is_archived", false)
    .order("name", { ascending: true });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Staf"
        description="Kelola akun dan peran staf"
      />
      <StaffTable
        profiles={(profiles ?? []) as Profile[]}
        outlets={(outlets ?? []) as Pick<Outlet, "id" | "name">[]}
        callerRole={caller.role}
        callerOutletId={caller.outlet_id}
      />
    </div>
  );
}
