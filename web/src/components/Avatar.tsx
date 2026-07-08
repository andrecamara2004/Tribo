// src/components/Avatar.tsx
// Initials avatar ported from the prototype. The brand palette below is used
// only to give a stable, cosmetic colour to an identifier — it never encodes
// real data.

const PALETTE = ["#00B86B", "#1B8A5A", "#3A7BD5", "#FFB020", "#D5398B", "#7B5BD9"];

/** Deterministic colour for a string — same input always maps to the same hue. */
function colorFromString(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({
  name = "??",
  color,
  size = "",
  pictureUrl,
}: {
  name?: string;
  color?: string;
  size?: "" | "sm" | "lg" | "xl";
  pictureUrl?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (pictureUrl) {
    return (
      <div className={"avatar " + size} style={{
        backgroundImage: `url(${pictureUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: 'transparent' // hide initials
      }}>
        {initials}
      </div>
    );
  }

  return (
    <div className={"avatar " + size} style={{ background: color ?? colorFromString(name) }}>
      {initials}
    </div>
  );
}
