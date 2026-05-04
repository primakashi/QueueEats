// Xendit QR Codes API wrapper.
// Docs: https://developers.xendit.co/api-reference/#create-qr-code

const XENDIT_API_BASE = "https://api.xendit.co";

export type XenditQRCode = {
  id: string;
  reference_id: string;
  type: "DYNAMIC" | "STATIC";
  currency: string;
  amount: number;
  qr_string: string;
  expires_at: string | null;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED";
  created: string;
  updated: string;
};

function authHeader() {
  const key = process.env.XENDIT_SECRET_KEY;
  if (!key) throw new Error("Missing XENDIT_SECRET_KEY");
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

export async function createQRCode(params: {
  referenceId: string;
  amount: number;
  expiresAt?: Date;
}): Promise<XenditQRCode> {
  const body = {
    reference_id: params.referenceId,
    type: "DYNAMIC" as const,
    currency: "IDR",
    amount: params.amount,
    expires_at:
      params.expiresAt?.toISOString() ??
      new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };

  const res = await fetch(`${XENDIT_API_BASE}/qr_codes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      "api-version": "2022-07-31",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xendit createQRCode failed (${res.status}): ${text}`);
  }

  return (await res.json()) as XenditQRCode;
}
