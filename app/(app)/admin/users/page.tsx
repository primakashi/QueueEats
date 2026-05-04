import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
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
        title="Staff"
        description="Change roles for staff accounts. Users sign up via the Supabase dashboard or invites."
      />
      <Card className="p-0 overflow-hidden">
        <StaffTable profiles={(data ?? []) as Profile[]} />
      </Card>
    </div>
  );
}
