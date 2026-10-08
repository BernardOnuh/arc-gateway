export interface RegisterPartnerParams {
  partnerName: string;
  email?: string;
}

export interface RegisterPartnerResult {
  partnerId: string;
  apiKey: string;
  keyPrefix: string;
  feeBps: number;
  rateLimitPerMin: number;
}

export interface CreateCustomerParams {
  externalId: string;
  recipientAddress: string;
}

export interface Customer {
  customerId: string;
  externalId: string;
  recipientAddress: string;
  createdAt: string;
}

export interface QuoteParams {
  originChainId: number;
  destChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  recipient: string;
  slippageBps: number;
  deadline: number;
  customerId?: string;
}

export interface Quote {
  quoteId: string;
  amountIn: string;
  feeAmount: string;
  feeBps: number;
  netAmount: string;
  estimatedOut: string;
  minOut: string;
  expiresAt: number;
  unsignedTx: string | null;
}

export interface SubmitIntentParams {
  quoteId: string;
  signedPayload: string;
}

export interface SubmitIntentResult {
  intentId: string;
}

export type IntentStatus =
  | "PENDING"
  | "ORIGIN_CONFIRMED"
  | "FILLED"
  | "EXECUTED_ON_ARC"
  | "REFUNDED"
  | "FAILED";

export interface Intent {
  id: string;
  status: IntentStatus;
  originTx: string | null;
  destTx: string | null;
  upstreamId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerCustomer {
  customerId: string | null;
  externalId: string | null;
  recipientAddress: string | null;
  transactions: number;
  amountInTotal: string;
  feeTotal: string;
}

export interface Ledger {
  partnerId: string;
  customerId: string | null;
  totals: {
    feeBps: number;
    transactions: number;
    amountInTotal: string;
    feeTotal: string;
  };
  byCustomer: LedgerCustomer[];
}

export interface ChainInfo {
  id: number;
  name: string;
  symbol: string;
  decimals: number;
  isArc: boolean;
  testnet: boolean;
  rpcUrl: string;
  explorerUrl: string;
  nativeTokenAddress: string;
}

export interface TokenInfo {
  chainId: number;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  isNative: boolean;
}