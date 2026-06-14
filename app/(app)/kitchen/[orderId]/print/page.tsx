import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";
import { AutoPrint } from "./auto-print";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ reprint?: string }>;
};

export default async function KitchenTicketPage({ params, searchParams }: Props) {
  await requireRole(["kitchen", "admin", "branch_manager", "waiter"]);
  const { orderId } = await params;
  const { reprint } = await searchParams;
  const isReprint = reprint === "1";
  const supabase = await createClient();

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at"),
  ]);

  if (!order) notFound();
  const o = order as Order;
  const orderItems = (items ?? []) as OrderItem[];

  const serviceLabel =
    o.service_type === "takeaway" ? "BUNGKUS" : "DINE-IN";

  return (
    <>
      <AutoPrint />
      {/* 58mm thermal — printable area ≈ 48mm. @page rule asks browser to
          pick 58×297mm paper so cuts land at the row end, not mid-line. */}
      <style>{`
        @page { size: 58mm auto; margin: 0; }
        @media print {
          html, body { margin: 0; padding: 0; background: #fff; }
        }
      `}</style>
      <div
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "12px",
          width: "48mm",
          margin: "0 auto",
          padding: "2mm",
          color: "#000",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "6px" }}>
          <div style={{ fontWeight: "bold", fontSize: "14px" }}>
            TIKET DAPUR
          </div>
          {isReprint && (
            <div
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                border: "1px solid #000",
                padding: "2px 6px",
                display: "inline-block",
                marginTop: "3px",
              }}
            >
              ** CETAK ULANG **
            </div>
          )}
        </div>

        <Divider />

        {/* Order info — bold so kitchen can scan fast */}
        <div style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "2px" }}>
          {o.order_number}
        </div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: "bold",
            marginBottom: "2px",
          }}
        >
          {serviceLabel}
          {o.table_number?.trim() ? ` · Meja ${o.table_number}` : ""}
        </div>
        {o.customer_name && (
          <div style={{ fontSize: "12px" }}>Pelanggan: {o.customer_name}</div>
        )}
        <div style={{ fontSize: "11px", color: "#555" }}>
          {formatDateTime(o.created_at)}
        </div>

        <Divider />

        {/* Items — large for kitchen visibility */}
        <div style={{ marginBottom: "4px" }}>
          {orderItems.map((item) => (
            <div key={item.id} style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", fontSize: "13px", fontWeight: "bold" }}>
                <span
                  style={{
                    minWidth: "22px",
                    textAlign: "right",
                    paddingRight: "6px",
                  }}
                >
                  {item.quantity}×
                </span>
                <span style={{ flex: 1, wordBreak: "break-word" }}>{item.name_snapshot}</span>
              </div>
              {item.notes && (
                <div
                  style={{
                    paddingLeft: "36px",
                    fontSize: "12px",
                    fontStyle: "italic",
                  }}
                >
                  * {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {o.notes && (
          <>
            <Divider />
            <div style={{ fontSize: "12px", fontStyle: "italic" }}>
              Catatan pesanan: {o.notes}
            </div>
          </>
        )}

        <Divider />

        <div style={{ textAlign: "center", fontSize: "11px", color: "#555" }}>
          {orderItems.reduce((s, i) => s + i.quantity, 0)} item total
        </div>
      </div>
    </>
  );
}

function Divider() {
  return (
    <div
      style={{
        borderTop: "1px dashed #000",
        margin: "5px 0",
      }}
    />
  );
}
