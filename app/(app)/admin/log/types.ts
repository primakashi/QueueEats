import type { CashierSession } from "@/lib/types";

export type SessionWithExtras = CashierSession & {
  outlet_name: string | null;
  opener_name: string | null;
  closer_name: string | null;
  cash_in: number;
  cash_out: number;
  cash_sales: number;
};

export type AuditLog = {
  id: string;
  table_name: string;
  record_id: string;
  entity_name: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string;
  created_at: string;
};

export type OperationalEventKind =
  | "order"
  | "order_cancel"
  | "session_open"
  | "session_close"
  | "cash_in"
  | "cash_out"
  | "stock";

export type OperationalEvent = {
  id: string;
  kind: OperationalEventKind;
  timestamp: string;
  actor_name: string | null;
  outlet_name: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
};
