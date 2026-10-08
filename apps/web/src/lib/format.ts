/** Defaults the gateway applies to new self-serve partners (src/config.ts). */
export const DEFAULT_FEE_BPS = 10;
export const DEFAULT_RATE_LIMIT_PER_MIN = 30;

/** 10 → "0.10%" */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Format an integer base-unit amount (string) with `decimals` places,
 * trimming trailing zeros. Uses BigInt so 18-decimal values stay exact.
 */
export function formatUnits(value: string, decimals: number, maxFraction = 6): string {
  let raw: bigint;
  try {
    raw = BigInt(value);
  } catch {
    return value;
  }
  const negative = raw < 0n;
  if (negative) raw = -raw;
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  if (raw !== 0n && whole === 0n && !fraction) return `${negative ? "-" : ""}<0.${"0".repeat(maxFraction - 1)}1`;
  const wholeStr = whole.toLocaleString("en-US");
  return `${negative ? "-" : ""}${wholeStr}${fraction ? `.${fraction}` : ""}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortId(id: string, head = 6, tail = 4): string {
  return id.length <= head + tail + 1 ? id : `${id.slice(0, head)}…${id.slice(-tail)}`;
}
