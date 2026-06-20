"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fafaf9",
          color: "#241C15",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
            Halaman gagal dimuat
          </h1>
          <p style={{ fontSize: 14, color: "#6E665B", marginBottom: 20 }}>
            Terjadi kesalahan tak terduga. Coba lagi atau muat ulang halaman.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid #241C15",
                background: "#241C15",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Coba lagi
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(36,28,21,.2)",
                background: "#fff",
                color: "#241C15",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Muat ulang
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
