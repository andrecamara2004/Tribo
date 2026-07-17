// src/components/Spinner.tsx
// Small reusable loading spinner. Use <Spinner /> inline, or <Spinner label="…" />
// for a centered block that replaces the old plain "Loading…" text.

export function Spinner({
  size = 18,
  label,
}: {
  size?: number;
  label?: string;
}) {
  const ring = (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label={label ?? "Loading"}
    />
  );

  if (!label) return ring;

  return (
    <div className="spinner-block">
      {ring}
      <span>{label}</span>
    </div>
  );
}
