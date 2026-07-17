// src/components/Spinner.tsx
// Reusable loading spinner:
//   <Spinner />                      inline ring
//   <Spinner label="Loading…" />     centered block with label
//   <Spinner cover label="…" />      fills the page content area (tab loads)
//   <Spinner fullscreen label="…" /> full-viewport overlay (session bootstrap)

export function Spinner({
  size = 18,
  label,
  cover = false,
  fullscreen = false,
}: {
  size?: number;
  label?: string;
  cover?: boolean;
  fullscreen?: boolean;
}) {
  const big = cover || fullscreen;
  const ring = (
    <span
      className="spinner"
      style={{ width: big ? 46 : size, height: big ? 46 : size }}
      role="status"
      aria-label={label ?? "Loading"}
    />
  );

  if (fullscreen || cover) {
    return (
      <div className={fullscreen ? "spinner-fullscreen" : "spinner-cover"}>
        {ring}
        {label && <span>{label}</span>}
      </div>
    );
  }

  if (!label) return ring;

  return (
    <div className="spinner-block">
      {ring}
      <span>{label}</span>
    </div>
  );
}
