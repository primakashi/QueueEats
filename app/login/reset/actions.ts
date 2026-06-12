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
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@solusissaji.com",
    to: email,
    subject: "Reset Kata Sandi — Solusi Saji POS",
    html: `
      <p>Halo,</p>
      <p>Kami menerima permintaan reset kata sandi untuk akun Anda.</p>
      <p>
        <a href="${data.properties.action_link}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
          Reset Kata Sandi
        </a>
      </p>
      <p>Link ini berlaku selama 1 jam. Jika Anda tidak meminta reset, abaikan email ini.</p>
      <p>— Tim Solusi Saji</p>
    `,
  });

  return { ok: true };
}
