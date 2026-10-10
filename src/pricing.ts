/**
 * Reference USD prices. The mock provider prices swaps with them, and
 * GET /v1/prices serves them when QUOTE_PROVIDER=mock (marked
 * source "reference"). With the arc provider, prices come from live quotes.
 */
const REFERENCE_USD: Record<string, number> = {
  ETH: 2500,
  WETH: 2500,
  BNB: 600,
  WBNB: 600,
  USDC: 1,
  USDT: 1,
  USDG: 1,
  EURC: 1.08,
  LINK: 15,
  AERO: 0.8,
  CAKE: 2.2,
  BRETT: 0.05,
  DEGEN: 0.004,
  PEPE: 0.00001,
  SHIB: 0.00002,
  BABYDOGE: 0.000000002,
};

export function referencePriceUsd(symbol: string): number | null {
  return REFERENCE_USD[symbol.toUpperCase()] ?? null;
}

/** Base units of a token → USD, as a float (display and estimates only). */
export function toUsd(amount: bigint, decimals: number, priceUsd: number): number {
  const scale = 10 ** Math.min(decimals, 12);
  const whole = Number(amount / 10n ** BigInt(decimals - Math.min(decimals, 12))) / scale;
  return whole * priceUsd;
}

/** USDC base units (any decimals) → whole cents, rounded down. */
export function usdcToCents(amount: bigint, decimals: number): number {
  if (decimals >= 2) return Number(amount / 10n ** BigInt(decimals - 2));
  return Number(amount * 10n ** BigInt(2 - decimals));
}
