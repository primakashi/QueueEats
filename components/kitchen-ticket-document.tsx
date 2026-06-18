import { formatDateTime } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";

type Props = {
  order: Order;
  items: OrderItem[];
  isReprint?: boolean;
};

/*
 * Kitchen ticket — 58mm thermal, larger fonts than the cashier receipt so
 * kitchen staff can read it quickly. Shared between the real kitchen print
 * page and the /admin/print-test sample page.
 */
export function KitchenTicketDocument({
  order: o,
  items: orderItems,
  isReprint = false,
}: Props) {
  const serviceLabel = o.service_type === "takeaway" ? "BUNGKUS" : "DINE-IN";

  return (
    <>
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
        <div style={{ textAlign: "center", marginBottom: "6px" }}>
          <div style={{ fontWeight: "bold", fontSize: "14px" }}>TIKET DAPUR</div>
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
                <span style={{ flex: 1, wordBreak: "break-word" }}>
                  {item.name_snapshot}
                </span>
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
