import { config } from "./config.js";

export interface ChainInfo {
  id: number;
  name: string;
  symbol: string;
  decimals: number;
  isArc: boolean;
  testnet: boolean;
  rpcUrl: string;
  explorerUrl: string;
  /** Gas token address. Zero-address = EVM native; on Arc it is the native USDC ERC-20. */
  nativeTokenAddress: string;
}

export const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Live chain registry. RPCs were checked (eth_chainId) on 2026-10-07:
 * Ethereum 0x1, BNB 0x38, Base 0x2105, Robinhood 0x1237 (4663),
 * Arc mainnet 0x13b2 (5042), Arc testnet 0x4cef52 (5042002).
 */
export const CHAINS: Record<number, ChainInfo> = {
  1: {
    id: 1,
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    isArc: false,
    testnet: false,
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    explorerUrl: "https://etherscan.io",
    nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
  },
  56: {
    id: 56,
    name: "BNB Smart Chain",
    symbol: "BNB",
    decimals: 18,
    isArc: false,
    testnet: false,
    rpcUrl: "https://bsc-dataseed.binance.org",
    explorerUrl: "https://bscscan.com",
    nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
  },
  8453: {
    id: 8453,
    name: "Base",
    symbol: "ETH",
    decimals: 18,
    isArc: false,
    testnet: false,
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
  },
  4663: {
    id: 4663,
    name: "Robinhood Chain",
    symbol: "ETH",
    decimals: 18,
    isArc: false,
    testnet: false,
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    explorerUrl: "https://robinhoodchain.blockscout.com",
    nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
  },
  5042: {
    id: 5042,
    name: "Arc",
    symbol: "USDC",
    decimals: 18,
    isArc: true,
    testnet: false,
    rpcUrl: "https://rpc.mainnet.arc.io",
    explorerUrl: "https://explorer.arc.io",
    nativeTokenAddress: "0x3600000000000000000000000000000000000000",
  },
};

// Active Arc network from config (defaults to testnet 5042002).
if (!CHAINS[config.arcChainId]) {
  CHAINS[config.arcChainId] = {
    id: config.arcChainId,
    name: "Arc Testnet",
    symbol: "USDC",
    decimals: 18,
    isArc: true,
    testnet: true,
    rpcUrl: config.arcRpcUrl,
    explorerUrl: "https://explorer.testnet.arc.io",
    nativeTokenAddress: "0x3600000000000000000000000000000000000000",
  };
}

export function getChain(id: number): ChainInfo | undefined {
  return CHAINS[id];
}

export function isSupportedChain(id: number): boolean {
  return Boolean(CHAINS[id]);
}

export function isArcChain(id: number): boolean {
  const chain = CHAINS[id];
  return Boolean(chain && chain.isArc);
}

export function getArcChain(): ChainInfo {
  return CHAINS[config.arcChainId];
}

export function listChains(): ChainInfo[] {
  return Object.values(CHAINS);
}