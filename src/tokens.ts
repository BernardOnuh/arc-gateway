import { getChain } from "./chains.js";
import { config } from "./config.js";

export interface TokenInfo {
  chainId: number;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  /** true if this is the chain's gas/native token */
  isNative: boolean;
}

const EIGHTEEN = 18;
const SIX = 6;

export const ARC_NATIVE_USDC = "0x3600000000000000000000000000000000000000";

function arcNative(chainId: number): TokenInfo {
  return {
    chainId,
    symbol: "USDC",
    name: "Arc native USDC (gas)",
    address: ARC_NATIVE_USDC,
    decimals: SIX,
    isNative: true,
  };
}

function native(chainId: number, symbol: string, decimals = EIGHTEEN): TokenInfo {
  const chain = getChain(chainId)!;
  return {
    chainId,
    symbol,
    name: `${chain.name} native gas`,
    address: chain.nativeTokenAddress,
    decimals,
    isNative: true,
  };
}

function token(
  chainId: number,
  symbol: string,
  name: string,
  address: string,
  decimals: number
): TokenInfo {
  return { chainId, symbol, name, address: address.toLowerCase(), decimals, isNative: false };
}

/**
 * ERC-20 addresses verified on-chain (eth_getCode + decimals()) on 2026-10-07.
 * Arc native USDC is an ERC-20 contract (6 decimals on the ERC-20 interface,
 * 18 in native gas accounting).
 */
export const TOKENS: Record<number, TokenInfo[]> = {
  1: [
    native(1, "ETH"),
    token(1, "WETH", "Wrapped Ether", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", EIGHTEEN),
    token(1, "USDC", "USD Coin", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", SIX),
    token(1, "USDT", "Tether USD", "0xdAC17F958D2ee523a2206206994597C13D831ec7", SIX),
    token(1, "LINK", "Chainlink", "0x514910771AF9Ca656af840dff83E8264EcF986CA", EIGHTEEN),
    token(1, "PEPE", "Pepe", "0x6982508145454Ce325dDbE47a25d4ec3d2311933", EIGHTEEN),
    token(1, "SHIB", "Shiba Inu", "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", EIGHTEEN),
  ],
  56: [
    native(56, "BNB"),
    token(56, "WBNB", "Wrapped BNB", "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", EIGHTEEN),
    token(56, "USDT", "Tether USD", "0x55d398326f99059fF775485246999027B3197955", EIGHTEEN),
    token(56, "USDC", "USD Coin", "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", EIGHTEEN),
    token(56, "CAKE", "PancakeSwap Token", "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", EIGHTEEN),
    token(56, "BABYDOGE", "Baby Doge Coin", "0xc748673057861a797275CD8A068AbB95A902e8de", 9),
    token(56, "PEPE", "Pepe (BSC)", "0x25d887Ce7a35172C62FeBFD67a1856F20FaEBb00", EIGHTEEN),
  ],
  8453: [
    native(8453, "ETH"),
    token(8453, "WETH", "Wrapped Ether", "0x4200000000000000000000000000000000000006", EIGHTEEN),
    token(8453, "USDC", "USD Coin", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", SIX),
    token(8453, "USDT", "Tether USD", "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", SIX),
    token(8453, "AERO", "Aerodrome", "0x940181a94A35A4569E4529A3CDfB74e38FD98631", EIGHTEEN),
    token(8453, "BRETT", "Based Brett", "0x532f27101965dd16442E59d40670FaF5eBB142E4", EIGHTEEN),
    token(8453, "DEGEN", "Degen", "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", EIGHTEEN),
  ],
  4663: [
    native(4663, "ETH"),
    token(4663, "WETH", "aeWETH (L2 WETH)", "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73", EIGHTEEN),
    token(4663, "USDG", "Global Dollar (Paxos)", "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", SIX),
    token(4663, "USDC", "USD Coin", "0x80e0e24718dbFcad49ECAA6F1e6C89A190586cA8", SIX),
  ],
  // Arc mainnet (5042): USDC verified on-chain (eth_getCode + decimals), EURC
  // from the Arc contract-addresses reference (0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1).
  5042: [
    arcNative(5042),
    token(5042, "EURC", "Euro Coin", "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1", SIX),
  ],
};

// Active Arc network from config (defaults to Arc testnet 5042002; skip if it
// is one of the explicitly seeded Arc networks above).
if (!TOKENS[config.arcChainId]) {
  TOKENS[config.arcChainId] = [
    arcNative(config.arcChainId),
    token(
      config.arcChainId,
      "EURC",
      "Euro Coin",
      "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
      SIX
    ),
  ];
}

export function getTokens(chainId: number): TokenInfo[] {
  return TOKENS[chainId] ?? [];
}

export function getTokenBySymbol(chainId: number, symbol: string): TokenInfo | undefined {
  const s = symbol.toLowerCase();
  return getTokens(chainId).find((t) => t.symbol.toLowerCase() === s);
}

export function getTokenByAddress(chainId: number, address: string): TokenInfo | undefined {
  const a = address.toLowerCase();
  return getTokens(chainId).find((t) => t.address.toLowerCase() === a);
}

/**
 * Accepts either a real token address (0x...) or a symbol like "WETH" / "USDC".
 * Resolves against the catalog for `chainId`.
 */
export function resolveToken(chainId: number, value: string): TokenInfo | undefined {
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) {
    return getTokenByAddress(chainId, value);
  }
  return getTokenBySymbol(chainId, value);
}

/** Convert a human amount to base units, e.g. "1.5" with 18 decimals -> 1500000000000000000. */
export function humanToBaseUnits(amount: string, decimals: number): string {
  const [whole = "0", frac = ""] = amount.split(".");
  const pad = (whole + frac.padEnd(decimals, "0")).replace(/^0+(?=\d)/, "");
  return (BigInt(pad || "0")).toString();
}