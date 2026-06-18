import { formatIDR, formatDateTime } from "@/lib/format";
import {
  ORDER_CHANNEL_LABEL,
  PAYMENT_STATUS_LABEL,
  type Order,
  type OrderItem,
} from "@/lib/types";

export type ReceiptAppliedDiscount = {
  name_snapshot: string;
  amount: number;
};

type Props = {
  order: Order;
  items: OrderItem[];
  appliedDiscounts: ReceiptAppliedDiscount[];
  brandName?: string;
};

/*
 * 58mm thermal receipt — printable area ≈ 48mm. Shared between the real
 * cashier print page and the /admin/print-test sample page so the two
 * cannot drift apart.
 */
export function ReceiptDocument({
  order: o,
  items: orderItems,
  appliedDiscounts,
  brandName = "Al Jazeerah Express",
}: Props) {
  const paymentLabel =
    o.payment_method === "edc"
      ? "EDC / Kartu"
      : o.payment_method === "cash"
        ? "Tunai"
        : o.payment_method === "qris"
          ? "QRIS"
          : "-";

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
          fontSize: "11px",
          width: "48mm",
          margin: "0 auto",
          padding: "2mm",
          color: "#000",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "6px" }}>
          <div style={{ fontWeight: "bold", fontSize: "13px" }}>{brandName}</div>
          <div style={{ fontSize: "10px" }}>Struk Pembayaran</div>
        </div>

        <Divider />

        <Row label="No. Pesanan" value={o.order_number} />
        <Row label="Waktu" value={formatDateTime(o.created_at)} />
        {o.service_type && (
          <Row
            label="Tipe"
            value={o.service_type === "takeaway" ? "Bungkus" : "Dine-in"}
          />
        )}
        {o.table_number && <Row label="Meja" value={o.table_number} />}
        {o.customer_name && <Row label="Pelanggan" value={o.customer_name} />}
        {o.order_channel && (
          <Row
            label="Channel"
            value={
              ORDER_CHANNEL_LABEL[
                o.order_channel as keyof typeof ORDER_CHANNEL_LABEL
              ] ?? o.order_channel
            }
          />
        )}

        <Divider />

        <div style={{ marginBottom: "4px" }}>
          {orderItems.map((item) => (
            <div key={item.id} style={{ marginBottom: "2px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ flex: 1, paddingRight: "4px" }}>
                  {item.quantity}x {item.name_snapshot}
                </span>
                <span style={{ whiteSpace: "nowrap" }}>
                  {formatIDR(item.price_snapshot * item.quantity)}
                </span>
              </div>
              {item.notes && (
                <div style={{ paddingLeft: "12px", fontSize: "11px", color: "#555" }}>
                  * {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        <Divider />

        {(o.tax_amount > 0 ||
          o.service_charge_amount > 0 ||
          (o.discount_amount ?? 0) > 0) && (
          <>
            <Row label="Subtotal" value={formatIDR(o.subtotal)} />
            {appliedDiscounts.map((d, idx) => (
              <Row
                key={idx}
                label={`Diskon · ${d.name_snapshot}`}
                value={`-${formatIDR(d.amount)}`}
              />
            ))}
            {o.tax_amount > 0 && (
              <Row label="Pajak" value={formatIDR(o.tax_amount)} />
            )}
            {o.service_charge_amount > 0 && (
              <Row label="Biaya Layanan" value={formatIDR(o.service_charge_amount)} />
            )}
          </>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
            fontSize: "12px",
            marginTop: "2px",
          }}
        >
          <span>TOTAL</span>
          <span>{formatIDR(o.total)}</span>
        </div>

        <Divider />

        <Row label="Pembayaran" value={paymentLabel} />
        {o.payment_destination && (
          <Row label="Ke" value={o.payment_destination} />
        )}
        <Row
          label="Status"
          value={PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status}
        />

        <Divider />

        <div style={{ textAlign: "center", fontSize: "10px", marginTop: "6px" }}>
          <div>Terima kasih atas kunjungan Anda!</div>
          <div style={{ color: "#555", marginTop: "2px" }}>
            Struk ini adalah bukti pembayaran yang sah.
          </div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "1px",
        fontSize: "10px",
      }}
    >
      <span style={{ color: "#555" }}>{label}</span>
      <span style={{ textAlign: "right", maxWidth: "55%", wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}
