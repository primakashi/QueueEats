// Routes QRIS creation to either real Xendit or a local mock.
// Mock kicks in whenever XENDIT_SECRET_KEY is not configured — handy for
// local development and demos without needing a Xendit sandbox account.

import { createQRCode as createXenditQR } from "./xendit";

export function isXenditConfigured(): boolean {
  return Boolean(process.env.XENDIT_SECRET_KEY);
}

type CreatedQR = {
  provider: "xendit" | "mock";
  id: string; // used as xendit_qr_id (nullable in the mock table too)
  qr_string: string;
  amount: number;
  expires_at: string;
  raw_payload: Record<string, unknown>;
};

export async function createPaymentQR(params: {
  referenceId: string;
  amount: number;
}): Promise<CreatedQR> {
  if (isXenditConfigured()) {
    const qr = await createXenditQR(params);
    return {
      provider: "xendit",
      id: qr.id,
      qr_string: qr.qr_string,
      amount: qr.amount,
      expires_at:
        qr.expires_at ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      raw_payload: qr as unknown as Record<string, unknown>,
    };
  }

  // Mock mode — qr_string is a sentinel; the client swaps it for
  // `${origin}/pay/<paymentId>` when rendering the QR.
  const id = `mock_${crypto.randomUUID()}`;
  return {
    provider: "mock",
    id,
    qr_string: "mock",
    amount: params.amount,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    raw_payload: {
      mock: true,
      reference_id: params.referenceId,
      created_at: new Date().toISOString(),
    },
  };
}
