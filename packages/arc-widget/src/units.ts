/** "1.5" with 18 decimals → "1500000000000000000". Returns null for invalid input. */
export function parseUnits(value: string, decimals: number): string | null {
  const v = value.trim();
  if (!/^\d*\.?\d*$/.test(v) || v === "" || v === ".") return null;
  const [whole = "", frac = ""] = v.split(".");
  if (frac.length > decimals) return null;
  const raw = BigInt((whole || "0") + frac.padEnd(decimals, "0"));
  return raw.toString();
}

/** Base units → human string, trimmed. */
export function formatUnits(value: string, decimals: number, maxFraction = 6): string {
  let raw: bigint;
  try {
    raw = BigInt(value);
  } catch {
    return value;
  }
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  if (raw !== 0n && whole === 0n && !fraction) return `<0.${"0".repeat(maxFraction - 1)}1`;
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}
