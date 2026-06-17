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
