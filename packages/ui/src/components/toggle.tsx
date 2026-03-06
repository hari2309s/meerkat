"use client";

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="toggle-btn relative inline-flex h-6 w-11 shrink-0 items-center rounded-full focus:outline-none transition-colors duration-200 disabled:opacity-50"
      style={{
        background: checked ? "var(--color-avatar-bg)" : "rgba(139,111,71,0.2)",
      }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? "translateX(26px)" : "translateX(2px)" }}
      />
    </button>
  );
}
