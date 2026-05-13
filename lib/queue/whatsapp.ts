const WA_TEST_NUMBER = "6281933221195";

export function generateWhatsAppUrl(phone: string, message: string): string {
  void phone;
  return `https://wa.me/${WA_TEST_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function logWhatsAppMock(phone: string | null, message: string): void {
  // Keep visible logs during development to verify mock notifications.
  console.log(`[WA MOCK] to ${phone ?? "-"}: ${message}`);
}
