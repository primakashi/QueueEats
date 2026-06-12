"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export async function requestPasswordReset(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Email wajib diisi" };

  const adminClient = createAdminClient();

  // Generate a recovery link. We always return ok:true to prevent email enumeration.
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login/update-password`,
    },
  });

  if (error || !data?.properties?.action_link) {
    // Log server-side but don't expose details to client
    console.error("[reset] generateLink error:", error?.message);
    return { ok: true }; // still return ok to prevent enumeration
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: sendError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@solusissaji.com",
    to: email,
    subject: "Reset Kata Sandi — Solusi Saji POS",
    html: `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Solusi Saji</p>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Point of Sale System</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Reset Kata Sandi</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Halo, kami menerima permintaan untuk mereset kata sandi akun Anda. Klik tombol di bawah untuk melanjutkan.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#0f172a;border-radius:8px;">
                  <a href="${data.properties.action_link}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.1px;">
                    Reset Kata Sandi →
                  </a>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
                    🔒 Link ini hanya berlaku selama <strong>1 jam</strong>.<br>
                    Jika Anda tidak meminta reset kata sandi, abaikan email ini — akun Anda tetap aman.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
              Email ini dikirim oleh <strong>Tim Solusi Saji</strong><br>
              Jangan balas email ini — kotak masuk ini tidak dipantau.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

  if (sendError) {
    console.error("[reset] Resend error:", sendError);
  }

  return { ok: true };
}
