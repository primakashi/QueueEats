import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type { Outlet, Profile } from "@/lib/types";
import { StaffTable } from "./staff-table";

export default async function StaffPage() {
  const caller = await requireRole(["admin", "owner", "branch_manager"]);
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const rid = getRestaurantFilter(caller);

  let profilesQuery = supabase.from("profiles").select("*").order("created_at", { ascending: true });
  if (caller.outlet_id) profilesQuery = profilesQuery.eq("outlet_id", caller.outlet_id);
  else if (rid) profilesQuery = profilesQuery.eq("restaurant_id", rid);

  let outletsQuery = supabase.from("outlets").select("id, name").eq("is_archived", false).order("name", { ascending: true });
  if (rid) outletsQuery = outletsQuery.eq("restaurant_id", rid);

  const [{ data: profiles }, { data: outlets }, { data: usersData }] = await Promise.all([
    profilesQuery,
    outletsQuery,
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailMap: Record<string, string> = {};
  for (const u of usersData?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email;
  }

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
        emailMap={emailMap}
      />
    </div>
  );
}
