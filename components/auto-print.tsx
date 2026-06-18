"use client";

import { useEffect, useRef, useState } from "react";

type Status = "loading" | "printing" | "done" | "error";

/*
 * Renders a full-screen overlay (hidden during print) that walks the user
 * through preparing -> printing -> done, then auto-closes the popup window.
 *
 * Behavior:
 *   1. Wait for the document `load` event so fonts/layout are ready before
 *      triggering `window.print()` — the previous bare 400ms setTimeout was
 *      not enough on slow tablets.
 *   2. Listen for `beforeprint`/`afterprint` events. After the print dialog
 *      closes (whether the user printed or cancelled), wait 1.5s for the
 *      thermal printer to finish feeding paper, then `window.close()`.
 *   3. If the print dialog never opens within 8s, surface a manual "Cetak
 *      Sekarang" button so the cashier isn't stuck staring at a spinner.
 *
 * The overlay is hidden via `[data-print-hide]` (globals.css @media print)
 * so it never lands on the receipt itself.
 */
export function AutoPrint() {
  const [status, setStatus] = useState<Status>("loading");
  // Ref tracks latest status so the watchdog timer (set inside a one-shot
  // effect) can read it without putting `status` in the dep array — putting
  // it there would re-run the effect on every state change and re-trigger
  // window.print() recursively.
  const statusRef = useRef<Status>("loading");
  const setStatusSafe = (next: Status) => {
    statusRef.current = next;
    setStatus(next);
  };

  useEffect(() => {
    let cancelled = false;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let triggerTimer: ReturnType<typeof setTimeout> | undefined;
    let watchdogTimer: ReturnType<typeof setTimeout> | undefined;

    const handleBeforePrint = () => {
      if (cancelled) return;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      setStatusSafe("printing");
    };
    const handleAfterPrint = () => {
      if (cancelled) return;
      setStatusSafe("done");
      closeTimer = setTimeout(() => {
        try {
          window.close();
        } catch {
          /* Chrome refuses to close tabs not opened via script — that's fine */
        }
      }, 1500);
    };

    const triggerPrint = () => {
      if (cancelled) return;
      try {
        window.print();
        watchdogTimer = setTimeout(() => {
          if (!cancelled && statusRef.current === "loading") setStatusSafe("error");
        }, 8000);
      } catch {
        if (!cancelled) setStatusSafe("error");
      }
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    let onLoad: (() => void) | undefined;
    if (document.readyState === "complete") {
      triggerTimer = setTimeout(triggerPrint, 300);
    } else {
      onLoad = () => {
        triggerTimer = setTimeout(triggerPrint, 300);
      };
      window.addEventListener("load", onLoad, { once: true });
    }

    return () => {
      cancelled = true;
      if (triggerTimer) clearTimeout(triggerTimer);
      if (closeTimer) clearTimeout(closeTimer);
      if (watchdogTimer) clearTimeout(watchdogTimer);
      if (onLoad) window.removeEventListener("load", onLoad);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const manualPrint = () => {
    setStatusSafe("loading");
    try {
      window.print();
    } catch {
      setStatusSafe("error");
    }
  };

  const closeWindow = () => {
    try {
      window.close();
    } catch {
      /* ignore */
    }
  };

  const messages: Record<Status, { title: string; subtitle?: string }> = {
    loading: {
      title: "Menyiapkan cetak…",
      subtitle: "Dialog cetak akan muncul dalam beberapa detik.",
    },
    printing: {
      title: "Mencetak…",
      subtitle: "Pastikan kertas thermal terpasang dan printer menyala.",
    },
    done: {
      title: "Selesai mencetak",
      subtitle: "Jendela ini akan tertutup otomatis.",
    },
    error: {
      title: "Dialog cetak belum muncul",
      subtitle:
        "Tekan tombol di bawah untuk membuka dialog cetak secara manual. Pastikan RawBT (atau aplikasi cetak lain) sudah terpasang dan dijadikan printer default.",
    },
  };

  const m = messages[status];

  return (
    <div
      data-print-hide
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(255, 255, 255, 0.96)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#111",
        zIndex: 99999,
        textAlign: "center",
        padding: "24px",
      }}
    >
      <style>{`
        @keyframes auto-print-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      {status === "loading" || status === "printing" ? (
        <div
          aria-hidden
          style={{
            width: "40px",
            height: "40px",
            border: "3px solid #e5e7eb",
            borderTopColor: "#111",
            borderRadius: "50%",
            animation: "auto-print-spin 0.8s linear infinite",
          }}
        />
      ) : status === "done" ? (
        <div
          aria-hidden
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "#10b981",
            color: "white",
            display: "grid",
            placeItems: "center",
            fontSize: "22px",
            fontWeight: 700,
          }}
        >
          ✓
        </div>
      ) : (
        <div
          aria-hidden
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "#fef3c7",
            color: "#92400e",
            display: "grid",
            placeItems: "center",
            fontSize: "22px",
            fontWeight: 700,
          }}
        >
          !
        </div>
      )}
      <div style={{ fontSize: "15px", fontWeight: 600 }}>{m.title}</div>
      {m.subtitle && (
        <div
          style={{
            fontSize: "13px",
            color: "#555",
            maxWidth: "320px",
            lineHeight: 1.4,
          }}
        >
          {m.subtitle}
        </div>
      )}
      {status === "error" && (
        <button
          type="button"
          onClick={manualPrint}
          style={{
            marginTop: "8px",
            padding: "10px 22px",
            background: "#111",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cetak Sekarang
        </button>
      )}
      {(status === "done" || status === "error") && (
        <button
          type="button"
          onClick={closeWindow}
          style={{
            marginTop: "4px",
            padding: "8px 18px",
            background: "transparent",
            color: "#555",
            border: "1px solid #d4d4d8",
            borderRadius: "8px",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Tutup
        </button>
      )}
    </div>
  );
}
