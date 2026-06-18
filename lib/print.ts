/**
 * Opens a popup window pointed at one of the /print pages. The window is
 * focused after open so its AutoPrint client component can trigger the
 * browser's print dialog without being stuck in the background tab — an
 * issue we've hit on Android Chrome.
 *
 * Returns `true` if the popup opened, `false` if blocked. Callers should
 * surface a toast on `false` instead of failing silently.
 */
export function openPrintWindow(url: string): boolean {
  // Mobile browsers ignore the features string, but width/height still hint
  // the popup size on desktop. toolbar=0/menubar=0 strips chrome on Firefox.
  const w = window.open(url, "_blank", "width=420,height=700,toolbar=0,menubar=0");
  if (!w) return false;
  try {
    w.focus();
  } catch {
    /* ignore — focus is best-effort */
  }
  return true;
}
