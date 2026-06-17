"use client";

export function Toggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      className={
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
        (checked ? "bg-zinc-900" : "bg-zinc-300")
      }
    >
      <span
        aria-hidden
        className={
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform " +
          (checked ? "translate-x-[22px]" : "translate-x-0.5")
        }
      />
    </button>
  );
}
