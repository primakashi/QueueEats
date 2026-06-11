"use server";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

type AuditAction = "create" | "update" | "delete";

type FieldChange = {
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

type LogParams = {
  table: string;
  recordId: string;
  entityName: string;
  action: AuditAction;
  changes?: FieldChange[];
};

export async function logAudit(by: Profile, params: LogParams): Promise<void> {
  const supabase = await createClient();

  const rows =
    params.changes && params.changes.length > 0
      ? params.changes.map((c) => ({
          table_name: params.table,
          record_id: params.recordId,
          entity_name: params.entityName,
          action: params.action,
          field_name: c.field,
          old_value: c.oldValue,
          new_value: c.newValue,
          changed_by_id: by.id,
          changed_by_name: by.full_name,
        }))
      : [
          {
            table_name: params.table,
            record_id: params.recordId,
            entity_name: params.entityName,
            action: params.action,
            field_name: null,
            old_value: null,
            new_value: null,
            changed_by_id: by.id,
            changed_by_name: by.full_name,
          },
        ];

  await supabase.from("audit_logs").insert(rows);
}
