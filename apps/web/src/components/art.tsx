import { useId, type ReactNode, type SVGProps } from "react";
import { useTheme } from "../lib/theme";

/**
 * Hand-built SVG artwork, icons and the product preview. Everything is inline so it themes with
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

export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
);
export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);

/** Soft periwinkle tile holding an icon (feature cards, steps). */
export function IconTile({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <span
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
        tone === "light" ? "bg-brand-100 text-ink-900" : "bg-ink-900 text-white"
      }`}
    >
      {children}
    </span>
  );
}

/** The ARC Gateway mark: a hexagon (the network) around an "A". Follows the theme. */
export function LogoMark({ size = 30, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="10" className={tone === "dark" ? "fill-ink-900" : "fill-snow"} />
      <path d="M16 6l8.7 5v10L16 26l-8.7-5V11z" fill="none" stroke="#8d99e4" strokeWidth="2.2" strokeLinejoin="round" />
      <path
        d="M11.5 20L16 10.5 20.5 20M13.1 16.8h5.8"
        fill="none"
        className={tone === "dark" ? "stroke-white" : "stroke-night"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One fluffy cloud: overlapping soft ellipses, blurred, bobbing gently. */
function Cloud({
  x,
  y,
  scale = 1,
  opacity = 0.9,
  blur,
  fill,
  bob,
}: {
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
  blur: string;
  fill: string;
  bob: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity} filter={`url(#${blur})`}>
      <g className="animate-float" style={{ animationDelay: `${bob}s`, animationDuration: `${8 + (bob % 4)}s` }}>
        <ellipse cx="0" cy="0" rx="120" ry="34" fill={fill} />
        <ellipse cx="-60" cy="-14" rx="62" ry="38" fill={fill} />
        <ellipse cx="20" cy="-34" rx="74" ry="48" fill={fill} />
        <ellipse cx="92" cy="-12" rx="56" ry="34" fill={fill} />
      </g>
    </g>
  );
}

// Few, well-spaced clouds, all clear of the tile edges (x 0 / 1920) so the loop has no seam.
const frontClouds = [
  { x: 360, y: 150, scale: 1.0, opacity: 0.85 },
  { x: 1560, y: 170, scale: 1.0, opacity: 0.8 },
  { x: 820, y: 720, scale: 1.4, opacity: 0.7 },
  { x: 1580, y: 560, scale: 0.9, opacity: 0.6 },
];
const backClouds = [
  { x: 560, y: 380, scale: 1.9, opacity: 0.35 },
  { x: 1250, y: 520, scale: 1.4, opacity: 0.3 },
  { x: 300, y: 820, scale: 2.2, opacity: 0.6 },
  { x: 1300, y: 840, scale: 2.4, opacity: 0.55 },
];

/** Deterministic star field (same sky every visit). */
const stars = Array.from({ length: 110 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: r(1) * 1920, y: r(2) * 720, size: r(3) < 0.85 ? 0.9 + r(4) : 1.8 + r(4), delay: r(5) * 4 };
});

function Stars() {
  return (
    <svg viewBox="0 0 1920 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      {stars.map((st, i) => (
        <circle
          key={i}
          cx={st.x}
          cy={st.y}
          r={st.size}
          fill="#fff"
          className="animate-twinkle"
          style={{ animationDelay: `${st.delay}s`, animationDuration: `${2.6 + (i % 5) * 0.6}s` }}
        />
      ))}
    </svg>
  );
}

function Moon() {
  return (
    <svg viewBox="0 0 120 120" className="absolute right-[8%] top-[max(1rem,9%)] h-20 w-20 sm:h-28 sm:w-28">
      <defs>
        <radialGradient id="moon-glow">
          <stop offset="0.45" stopColor="#dfe6ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#dfe6ff" stopOpacity="0" />
        </radialGradient>
        <mask id="moon-cut">
          <rect width="120" height="120" fill="#fff" />
          <circle cx="74" cy="48" r="26" fill="#000" />
        </mask>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#moon-glow)" />
      <circle cx="60" cy="60" r="28" fill="#f4f6ff" mask="url(#moon-cut)" />
    </svg>
  );
}

const DAY_SKY = "linear-gradient(180deg, #3d5fae 0%, #5b7fc9 38%, #8eaae0 72%, #c3d3f1 100%)";
const NIGHT_SKY = "linear-gradient(180deg, #060918 0%, #0d1433 40%, #1a2558 78%, #26346c 100%)";

/**
 * Painted sky behind heroes. Day: blue gradient with a few drifting clouds.
 * Night (dark theme): deep navy, twinkling stars, a crescent moon and faint
 * clouds. Each cloud layer is two unscaled 1920px tiles side by side, so the
 * loop is seamless at any viewport size.
 */
export function SkyBackdrop({ className = "" }: { className?: string }) {
  const { theme } = useTheme();
  const night = theme === "dark";
  const id = useId().replace(/:/g, "");
  const fill = night ? "#aeb9e6" : "#ffffff";
  const layer = (clouds: typeof frontClouds, blur: number, anim: string, key: string, dim: number) => (
    <div className={`absolute left-0 top-0 flex h-[900px] w-[3840px] ${anim}`}>
      {[0, 1].map((k) => (
        <svg key={k} width="1920" height="900" viewBox="0 0 1920 900" overflow="visible" className="shrink-0">
          <defs>
            <filter id={`${id}${key}${k}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={blur} />
            </filter>
          </defs>
          {clouds.map((c, i) => (
            <Cloud key={i} {...c} opacity={c.opacity * dim} blur={`${id}${key}${k}`} fill={fill} bob={i * 1.7} />
          ))}
        </svg>
      ))}
    </div>
  );
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden transition-[background] duration-700 ${className}`}
      style={{ background: night ? NIGHT_SKY : DAY_SKY }}
    >
      {night && (
        <>
          <Stars />
          <Moon />
        </>
      )}
      {layer(backClouds, night ? 22 : 18, "animate-drift-slow", "b", night ? 0.22 : 1)}
      {layer(frontClouds, night ? 10 : 6, "animate-drift", "f", night ? 0.25 : 1)}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-snow/20 dark:to-transparent" />
    </div>
  );
}

export const IconSun = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </Icon>
);
export const IconMoon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Icon>
);

/** Small illustration for empty tables and lists. */
export function EmptyArt({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 80" className={className}>
      <ellipse cx="60" cy="40" rx="50" ry="22" fill="none" stroke="#d0d6f6" strokeDasharray="3 5" />
      <path d="M60 16 80 27.5v23L60 62 40 50.5v-23z" fill="#e6e9fb" stroke="#6b78d6" strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 27.5 60 39l20-11.5M60 39v23" fill="none" stroke="#6b78d6" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="13" cy="34" r="3" fill="#b2bbef" />
      <circle cx="106" cy="48" r="3" fill="#1c1f3f" />
    </svg>
  );
}

/** Line chart for the preview: weekly settled volume with a tooltip on the peak. */
function VolumeChart() {
  const pts = [
    [0, 92], [40, 70], [80, 96], [120, 30], [150, 88], [190, 104], [230, 74], [270, 100], [300, 84],
  ];
  const d = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x} ${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C${cx} ${py} ${cx} ${y} ${x} ${y}`;
  }, "");
  return (
    <svg viewBox="-24 -10 340 150" className="w-full">
      <defs>
        <linearGradient id="pv-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8d99e4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8d99e4" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[24, 64, 104].map((y, i) => (
        <g key={y}>
          <line x1="0" x2="300" y1={y} y2={y} stroke="#e3e6f6" />
          <text x="-8" y={y + 3} textAnchor="end" fontSize="8" fill="#8a8fb3">
            {["90k", "60k", "30k"][i]}
          </text>
        </g>
      ))}
      <rect x="112" y="30" width="16" height="96" rx="4" fill="url(#pv-bar)" />
      <path d={d} fill="none" stroke="#1c1f3f" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="120" cy="30" r="4" fill="#fff" stroke="#1c1f3f" strokeWidth="2" />
      <g transform="translate(120 10)">
        <rect x="-26" y="-12" width="52" height="16" rx="5" fill="#1c1f3f" />
        <text y="-1" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="600">
          $84,210
        </text>
      </g>
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
        <text key={d} x={i * 50} y="138" textAnchor="middle" fontSize="8" fill={i === 2 ? "#1c1f3f" : "#8a8fb3"} fontWeight={i === 2 ? 700 : 400}>
          {d}
        </text>
      ))}
    </svg>
  );
}

const previewNav = [
  { icon: <IconHome size={16} />, label: "Overview", active: true },
  { icon: <IconUsers size={16} />, label: "Customers" },
  { icon: <IconSwap size={16} />, label: "Transactions" },
  { icon: <IconChart size={16} />, label: "Ledger" },
  { icon: <IconWidget size={16} />, label: "Widget" },
  { icon: <IconSettings size={16} />, label: "Settings" },
];

const previewRows = [
  { pair: "WETH → USDC", route: "Ethereum → ARC", amount: "$12,480.00", status: "Settled" },
  { pair: "USDC → USDC", route: "Base L2 → ARC", amount: "$2,150.00", status: "Settled" },
  { pair: "WBNB → EURC", route: "BNB → ARC", amount: "$940.75", status: "Filling" },
  { pair: "WETH → USDC", route: "Base L2 → ARC", amount: "$5,300.00", status: "Settled" },
];

/**
 * Decorative mock of the partner dashboard for marketing pages. Sample
 * numbers only; hidden from assistive tech (the page copy carries the meaning).
 */
export function ProductPreview({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`select-none rounded-[28px] bg-mist-200/90 p-3 text-ink-900 sm:p-5 ${className}`}>
      <div className="flex items-center gap-4 px-2 pb-4">
        <span className="flex w-40 shrink-0 items-center gap-2 text-sm font-bold">
          <LogoMark size={22} /> ARC Gateway
        </span>
        <span className="hidden flex-1 items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs text-ink-400 sm:flex md:max-w-xs">
          <IconSearch size={14} /> Search intents
        </span>
        <span className="ml-auto flex items-center gap-3 text-xs font-semibold">
          USDC
          <IconBell size={16} />
          <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-900 text-[11px] text-white">AP</span>
        </span>
      </div>
      <div className="flex gap-4">
        <ul className="hidden w-40 shrink-0 space-y-1 pt-4 text-xs font-semibold md:block">
          {previewNav.map((n) => (
            <li
              key={n.label}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${n.active ? "bg-white text-ink-900 shadow-soft" : "text-ink-700"}`}
            >
              {n.icon}
              {n.label}
            </li>
          ))}
        </ul>
        <div className="grid min-w-0 flex-1 gap-4 rounded-[22px] bg-white p-4 sm:p-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr]">
              <div className="rounded-2xl bg-card-sheen p-4">
                <div className="flex items-center justify-between text-[11px] font-semibold text-ink-700">
                  Fees earned <span className="rounded-full bg-white/70 px-2 py-0.5">0.10%</span>
                </div>
                <p className="mt-5 text-xl font-bold tracking-tight">1,284.20 USDC</p>
                <p className="mt-1 text-[10px] text-ink-600">Acme Pay · this month</p>
              </div>
              <div className="rounded-2xl bg-brand-100 p-4">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-900 text-white">
                  <IconUsers size={14} />
                </span>
                <p className="mt-3 text-[11px] font-semibold">Customers</p>
                <p className="text-lg font-bold">1,204</p>
              </div>
              <div className="hidden rounded-2xl bg-brand-100 p-4 sm:block">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-900 text-white">
                  <IconBolt size={14} />
                </span>
                <p className="mt-3 text-[11px] font-semibold">Intents today</p>
                <p className="text-lg font-bold">86</p>
              </div>
            </div>
            <p className="mt-5 text-sm font-bold">Recent intents</p>
            <ul className="mt-2 divide-y divide-mist-200 text-[11px]">
              {previewRows.map((r, i) => (
                <li key={i} className="grid grid-cols-[1.2fr_1fr_auto] items-center gap-3 py-2.5 sm:grid-cols-[1.2fr_1.2fr_1fr_auto]">
                  <span className="font-bold">{r.pair}</span>
                  <span className="hidden text-ink-400 sm:block">{r.route}</span>
                  <span className="font-semibold">{r.amount}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      r.status === "Settled" ? "bg-emerald-50 text-emerald-700" : "bg-brand-100 text-brand-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden rounded-2xl bg-mist-50 p-4 lg:block">
            <p className="text-[11px] text-ink-600">Settled this week</p>
            <p className="text-2xl font-bold tracking-tight">$482,190</p>
            <div className="mt-3">
              <VolumeChart />
            </div>
            <p className="mt-3 text-sm font-bold">Destination</p>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-card-sheen px-3 py-2.5 text-[11px]">
              <span className="font-bold">ARC mainnet</span>
              <span className="text-ink-600">USDC · EURC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
