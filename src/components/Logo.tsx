import { C } from "@/lib/design";

/**
 * The starjar mark: a jar with a four-point star inside. One colour; the star
 * is filled and the jar is drawn, so the mark reads at favicon size.
 */
export function Mark({ colour = C.sun, size = 26 }: { colour?: string; size?: number }) {
  return (
    <svg viewBox="0 0 110 110" width={size} height={size} aria-hidden style={{ display: "block", flex: "none" }}>
      <path d="M36 16 H74" fill="none" stroke={colour} strokeWidth="11" strokeLinecap="round" />
      <rect x="20" y="30" width="70" height="70" rx="20" fill="none" stroke={colour} strokeWidth="11" />
      <path
        d="M55 46 C57 58 61 62 73 65 C61 68 57 72 55 84 C53 72 49 68 37 65 C49 62 53 58 55 46 Z"
        fill={colour}
      />
    </svg>
  );
}

export function Lockup({ colour = C.sun, size = 26 }: { colour?: string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32 }}>
      <Mark colour={colour} size={size} />
      <span
        style={{
          fontWeight: 800,
          fontSize: size * 0.84,
          letterSpacing: "-.055em",
          textTransform: "lowercase",
          color: colour,
          lineHeight: 1,
        }}
      >
        starjar
      </span>
    </span>
  );
}
