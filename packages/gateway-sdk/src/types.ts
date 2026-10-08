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

export interface LedgerTokenTotals {
  chainId: number;
  symbol: string;
  address: string;
  /** null if the token is no longer in the gateway's registry. */
  decimals: number | null;
  transactions: number;
  amountInTotal: string;
  feeTotal: string;
}

export interface LedgerCustomer {
  customerId: string | null;
  externalId: string | null;
  recipientAddress: string | null;
  transactions: number;
  amountInTotal: string;
  feeTotal: string;
  byToken: LedgerTokenTotals[];
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
  /** Totals per origin token. Use these for display: the raw totals mix decimals. */
  byToken: LedgerTokenTotals[];
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

export interface PageParams {
  limit?: number;
  offset?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListQuotesParams extends PageParams {
  customerId?: string;
}

export interface QuoteListItem {
  quoteId: string;
  customerId: string | null;
  originChainId: number;
  destChainId: number;
  tokenIn: string;
  tokenOut: string;
  recipient: string;
  amountIn: string;
  feeAmount: string;
  feeBps: number;
  netAmount: string;
  estimatedOut: string | null;
  minOut: string | null;
  expiresAt: number;
  createdAt: string;
  intent: { intentId: string; status: IntentStatus } | null;
}

export interface ListIntentsParams extends PageParams {
  status?: IntentStatus;
  customerId?: string;
}

export interface IntentListItem {
  id: string;
  quoteId: string;
  customerId: string | null;
  originChainId: number;
  destChainId: number;
  amountIn: string;
  feeAmount: string;
  status: IntentStatus;
  originTx: string | null;
  destTx: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerProfile {
  partnerId: string;
  name: string;
  email: string | null;
  feeBps: number;
  rateLimitPerMin: number;
  createdAt: string;
  apiKey: { id: string; keyPrefix: string; createdAt: string };
}

export type ApiKeyKind = "secret" | "publishable";

export interface ApiKeySummary {
  id: string;
  kind: ApiKeyKind;
  keyPrefix: string;
  last4: string | null;
  /** Full publishable key (public by design); always null for secret keys. */
  publishableKey: string | null;
  allowedOrigins: string[] | null;
  active: boolean;
  /** True for the key that made the request. */
  current: boolean;
  createdAt: string;
  revokedAt: string | null;
}

export interface RotateApiKeyResult {
  /** The new secret key, shown once. The calling key is already revoked. */
  apiKey: string;
  key: ApiKeySummary;
}

export interface CreatePublishableKeyParams {
  allowedOrigins: string[];
}
