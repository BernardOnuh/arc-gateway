import { useId, type ReactNode, type SVGProps } from "react";

/**
 * Hand-built SVG artwork and icons. Everything is inline so it themes with
 * currentColor / brand gradients and costs no extra requests. Decorative
 * pieces are aria-hidden; the page text carries the meaning.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconKey = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="M10.8 12.2 20 3m-3 3 2.5 2.5M14.5 8.5 17 11" />
  </Icon>
);
export const IconUsers = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4" />
    <path d="M15.5 4.8a3.2 3.2 0 0 1 0 6.4M17.5 14.8c1.9.6 3.1 2.4 3.5 5.2" />
  </Icon>
);
export const IconBolt = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12z" />
  </Icon>
);
export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z" />
    <path d="m8.8 12.2 2.2 2.2 4.4-4.6" />
  </Icon>
);
export const IconChart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="m7.5 15 3.5-4 3 2.5L19 7" />
  </Icon>
);
export const IconCode = (p: IconProps) => (
  <Icon {...p}>
    <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" />
  </Icon>
);
export const IconLayers = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5" />
  </Icon>
);
export const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);
export const IconHome = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
  </Icon>
);
export const IconSwap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
  </Icon>
);
export const IconBook = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
    <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" />
  </Icon>
);
export const IconWidget = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <path d="M17 13.5v7M13.5 17h7" />
  </Icon>
);
export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icon>
);
export const IconLogout = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4" />
  </Icon>
);
export const IconWallet = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7a2 2 0 0 1 2-2h11v4" />
    <rect x="4" y="7" width="16" height="12" rx="2" />
    <circle cx="16" cy="13" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

/** Rounded gradient tile holding an icon (feature cards, steps). */
export function IconTile({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "dark" }) {
  return (
    <span
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
        tone === "brand"
          ? "bg-gradient-to-br from-brand-500/15 to-accent-400/15 text-brand-600 ring-1 ring-brand-500/20"
          : "bg-white/5 text-accent-300 ring-1 ring-white/10"
      }`}
    >
      {children}
    </span>
  );
}

/** The ARC Gateway mark: a hexagon (the network) around an "A". */
export function LogoMark({ size = 30 }: { size?: number }) {
  const id = useId();
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7552ff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#0a1024" />
      <path
        d="M16 5l9.5 5.5v11L16 27l-9.5-5.5v-11z"
        fill="none"
        stroke={`url(#${id}g)`}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M11 20.5L16 10l5 10.5M12.8 17h6.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Soft glow blobs and a faint grid behind dark sections. */
export function GlowBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-600/30 blur-[110px]" />
      <div className="absolute -right-24 top-24 h-[22rem] w-[22rem] rounded-full bg-accent-500/20 blur-[110px]" />
    </div>
  );
}

const sources = [
  { x: 78, y: 92, label: "Ethereum", glyph: "eth" },
  { x: 442, y: 86, label: "Base", glyph: "base" },
  { x: 60, y: 330, label: "BNB Chain", glyph: "bnb" },
  { x: 452, y: 336, label: "Robinhood", glyph: "hood" },
] as const;

function ChainGlyph({ kind }: { kind: (typeof sources)[number]["glyph"] }) {
  switch (kind) {
    case "eth":
      return (
        <g fill="none" stroke="#c7d2fe" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M0-13 9 1 0 6-9 1z" />
          <path d="M-9 4 0 14 9 4 0 9z" />
        </g>
      );
    case "base":
      return (
        <g>
          <circle r="11" fill="#2f6bff" />
          <path d="M-11 0h13" stroke="#0a1024" strokeWidth="3" />
        </g>
      );
    case "bnb":
      return (
        <g fill="#f3ba2f">
          <rect x="-4" y="-4" width="8" height="8" transform="rotate(45)" />
          <rect x="-2.6" y="-13" width="5.2" height="5.2" transform="rotate(45 0 -10.4)" />
          <rect x="-2.6" y="7.8" width="5.2" height="5.2" transform="rotate(45 0 10.4)" />
          <rect x="-13" y="-2.6" width="5.2" height="5.2" transform="rotate(45 -10.4 0)" />
          <rect x="7.8" y="-2.6" width="5.2" height="5.2" transform="rotate(45 10.4 0)" />
        </g>
      );
    case "hood":
      return (
        <path
          d="M-8 10C-6 0-1-8 9-11-1-4-3 4-3 10z"
          fill="#c3f53c"
        />
      );
  }
}

/**
 * Hero: source chains stream value along animated paths into the ARC
 * hexagon, which settles it to a customer wallet.
 */
export function HeroNetwork({ className = "" }: { className?: string }) {
  const id = useId();
  const cx = 260;
  const cy = 210;
  return (
    <svg aria-hidden viewBox="0 0 520 440" className={className}>
      <defs>
        <linearGradient id={`${id}flow`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9175ff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <radialGradient id={`${id}core`} cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#2a1d6c" />
          <stop offset="1" stopColor="#0a1024" />
        </radialGradient>
        <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* orbit rings */}
      <g fill="none" stroke="#7d8bb5" strokeOpacity="0.18">
        <circle cx={cx} cy={cy} r="120" />
        <circle cx={cx} cy={cy} r="175" strokeDasharray="2 8" />
      </g>

      {/* flows: chain -> ARC */}
      {sources.map((s) => {
        const mx = (s.x + cx) / 2 + (s.y < cy ? 0 : 0);
        const my = s.y < cy ? cy - 40 : cy + 40;
        const d = `M${s.x} ${s.y} Q${mx} ${my} ${cx} ${cy}`;
        return (
          <g key={s.label}>
            <path d={d} fill="none" stroke="#7d8bb5" strokeOpacity="0.2" strokeWidth="2" />
            <path
              d={d}
              fill="none"
              stroke={`url(#${id}flow)`}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray="6 14"
              className="animate-dash"
            />
          </g>
        );
      })}

      {/* settlement: ARC -> wallet */}
      <path
        d={`M${cx} ${cy + 96} L${cx} 384`}
        fill="none"
        stroke="#22d3ee"
        strokeWidth="2.4"
        strokeDasharray="6 14"
        strokeLinecap="round"
        className="animate-dash"
      />

      {/* source chain nodes */}
      {sources.map((s, i) => (
        <g key={s.label} transform={`translate(${s.x} ${s.y})`}>
          <g className="animate-float" style={{ animationDelay: `${i * -1.3}s` }}>
            <circle r="30" fill="#111a36" stroke="#2a3766" strokeWidth="1.5" />
            <ChainGlyph kind={s.glyph} />
            <text y="50" textAnchor="middle" fill="#a9b4d6" fontSize="12" fontFamily="Inter Variable, sans-serif">
              {s.label}
            </text>
          </g>
        </g>
      ))}

      {/* ARC core */}
      <g transform={`translate(${cx} ${cy})`}>
        <circle r="54" fill="none" stroke="#7552ff" strokeOpacity="0.5" className="origin-center animate-pulse-ring" style={{ transformBox: "fill-box" }} />
        <path
          d="M0-62 54-31v62L0 62-54 31v-62z"
          fill={`url(#${id}core)`}
          stroke={`url(#${id}flow)`}
          strokeWidth="2.5"
          strokeLinejoin="round"
          filter={`url(#${id}glow)`}
        />
        <path
          d="M-17 18 0-20 17 18M-11 6h22"
          fill="none"
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text y="88" textAnchor="middle" fill="#e8e2ff" fontSize="13" fontWeight="600" fontFamily="Space Grotesk Variable, sans-serif">
          ARC network
        </text>
      </g>

      {/* customer wallet */}
      <g transform={`translate(${cx} 404)`}>
        <rect x="-72" y="-20" width="144" height="40" rx="12" fill="#111a36" stroke="#22d3ee" strokeOpacity="0.6" />
        <circle cx="-50" r="7" fill="#22d3ee" />
        <text x="-36" y="4.5" fill="#e0f7ff" fontSize="12.5" fontFamily="Inter Variable, sans-serif">
          Settled · USDC
        </text>
      </g>
    </svg>
  );
}

/** Auth side panel: a key turning into a session, guarded by a shield. */
export function AuthArt({ className = "" }: { className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden viewBox="0 0 360 300" className={className}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9175ff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#7d8bb5" strokeOpacity="0.2">
        <circle cx="180" cy="150" r="70" />
        <circle cx="180" cy="150" r="115" strokeDasharray="2 8" />
      </g>
      {/* back card */}
      <g transform="translate(70 70) rotate(-8)">
        <rect width="170" height="104" rx="16" fill="#111a36" stroke="#2a3766" />
        <rect x="18" y="22" width="70" height="8" rx="4" fill="#2a3766" />
        <rect x="18" y="42" width="120" height="8" rx="4" fill="#1b264a" />
        <rect x="18" y="62" width="96" height="8" rx="4" fill="#1b264a" />
      </g>
      {/* front card with key */}
      <g transform="translate(118 112) rotate(6)">
        <rect width="178" height="110" rx="16" fill="#0a1024" stroke={`url(#${id}g)`} strokeWidth="1.8" />
        <g transform="translate(26 55)" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round">
          <circle r="13" />
          <path d="M13 0h58M56 0v12M44 0v8" />
        </g>
        <rect x="26" y="86" width="64" height="7" rx="3.5" fill="#2a3766" />
        <text x="26" y="30" fill="#a9b4d6" fontSize="11" fontFamily="JetBrains Mono Variable, monospace">
          gw_live_••••
        </text>
      </g>
      {/* shield badge */}
      <g transform="translate(268 74)">
        <g className="animate-float">
        <circle r="26" fill="#111a36" stroke={`url(#${id}g)`} strokeWidth="1.8" />
        <path d="M0-13-10-9v7c0 6.5 4.3 11 10 12.5C5.7 9 10 4.5 10-2v-7z" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinejoin="round" />
        <path d="m-4.5 0 3 3 6-6.5" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

/** Small illustration for empty tables and lists. */
export function EmptyArt({ className = "" }: { className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden viewBox="0 0 120 80" className={className}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9175ff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="40" rx="50" ry="22" fill="none" stroke="#cbd5e1" strokeDasharray="3 5" />
      <path d="M60 16 80 27.5v23L60 62 40 50.5v-23z" fill="#f3f0ff" stroke={`url(#${id}g)`} strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 27.5 60 39l20-11.5M60 39v23" fill="none" stroke={`url(#${id}g)`} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="13" cy="34" r="3" fill="#22d3ee" />
      <circle cx="106" cy="48" r="3" fill="#9175ff" />
    </svg>
  );
}
