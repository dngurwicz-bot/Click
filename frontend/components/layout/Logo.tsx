import Link from "next/link";

const SIZES = {
  sm: { text: 20, dot: 20, divH: 16, subText: 10, gap: 8 },
  md: { text: 26, dot: 26, divH: 20, subText: 12, gap: 10 },
  lg: { text: 36, dot: 36, divH: 28, subText: 15, gap: 12 },
};

const VARIANTS = {
  dark:  { main: "#2C3E50", sub: "#7F8C8D",  divider: "#BDC3C7" },
  light: { main: "#ffffff", sub: "#94a3b8",  divider: "rgba(255,255,255,0.25)" },
};

interface LogoProps {
  href?: string;
  size?: keyof typeof SIZES;
  variant?: keyof typeof VARIANTS;
}

export function Logo({ href = "/dashboard", size = "md", variant = "dark" }: LogoProps) {
  const s = SIZES[size];
  const v = VARIANTS[variant];

  const inner = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: s.gap,
        direction: "ltr",
        cursor: href ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <span
        style={{
          fontFamily: "'Rubik', 'Heebo', sans-serif",
          fontSize: s.text,
          fontWeight: 900,
          color: v.main,
          letterSpacing: "-0.5px",
          lineHeight: 1,
        }}
      >
        CLICK
        <span style={{ color: "#00A896" }}>.</span>
      </span>

      <div
        style={{
          width: 1,
          height: s.divH,
          backgroundColor: v.divider,
          flexShrink: 0,
        }}
      />

      <span
        style={{
          fontFamily: "'Rubik', 'Heebo', sans-serif",
          fontSize: s.subText,
          fontWeight: 600,
          color: v.sub,
          lineHeight: 1.2,
          letterSpacing: "0.04em",
        }}
      >
        DNG
        <br />
        HUB
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none" }}>
        {inner}
      </Link>
    );
  }
  return inner;
}
