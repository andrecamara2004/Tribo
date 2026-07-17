// src/components/Icon.tsx
// Inline SVG icon set ported from the prototype — single stroke style for
// visual cohesion. Add new glyphs here as screens need them.
import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  home:    <><path d="M3 11.5 12 3l9 8.5" /><path d="M5 10v11h14V10" /></>,
  run:     <><circle cx="14" cy="5" r="2" /><path d="M4 21l4-5 3 1 4-3 4 3" /><path d="M9 13l3-3 3 3-3 4" /></>,
  trophy:  <><path d="M8 21h8M12 17v4" /><path d="M7 4h10v6a5 5 0 0 1-10 0z" /><path d="M17 4h3v3a3 3 0 0 1-3 3M7 4H4v3a3 3 0 0 0 3 3" /></>,
  leaf:    <><path d="M11 20A7 7 0 0 1 4 13c0-5 5-9 13-9-2 7-4 12-13 16" /><path d="M2 22c2-3 5-5 13-9" /></>,
  user:    <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
  bell:    <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
  pin:     <><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  clock:   <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  flame:   <><path d="M12 2c1 4-2 6-2 9a4 4 0 0 0 8 0c0-2-1-3-2-5 0 2-2 3-2 1 0-2 0-3-2-5z" /></>,
  settings:<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  logout:  <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  plus:    <><path d="M12 5v14M5 12h14" /></>,
  ruler:   <><path d="M3 12l9-9 9 9-9 9z" /><path d="M7 13l1.5 1.5M10 10l1.5 1.5M13 7l1.5 1.5" /></>,
  users:   <><circle cx="9" cy="8" r="3.5" /><path d="M3 21a6 6 0 0 1 12 0" /><path d="M16 5.5a3.5 3.5 0 0 1 0 6.8M21 21a6 6 0 0 0-5-5.9" /></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  back:    <><path d="M19 12H5M12 19l-7-7 7-7" /></>,
  heart:   <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z" /></>,
  comment: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  search:  <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
};

export const Icon = ({
  name,
  size = 20,
  className,
}: {
  name: keyof typeof ICONS | string;
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {ICONS[name] ?? null}
  </svg>
);
