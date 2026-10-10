export interface RegisterPartnerParams {
  partnerName: string;
  /** Contact and dashboard sign-in email. */
  email: string;
  /** Dashboard password, at least 10 characters. */
  password: string;
}

/** Dashboard sign-in: email + password, or a secret key. */
export type DashboardCredentials = { email: string; password: string } | { apiKey: string };

export interface SetPasswordParams {
  /** Required when a password is already set. */
  currentPassword?: string;
  newPassword: string;
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
  /** Set by the customer during account setup. */
  email: string | null;
  hasPassword: boolean;
  payoutWallet: string | null;
  payoutChainId: number | null;
  createdAt: string;
}

export interface SetupLink {
  customerId: string;
  /** One-time token (cst_…), valid 72h. Shown once. */
  token: string;
  expiresAt: string;
}

export interface CustomerAccount {
  customerId: string;
  partnerId: string;
  partnerName: string;
  externalId: string;
  email: string | null;
  recipientAddress: string;
  payoutWallet: string | null;
  payoutChainId: number | null;
  /** Always false for now: wallets are stored for future payouts. */
  payoutsEnabled: boolean;
}

export interface CustomerSession {
  sessionToken: string;
  expiresAt: string;
  account: CustomerAccount;
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
  /** Whether email + password sign-in is set up. */
  hasPassword: boolean;
  /** ARC address that receives checkout payments. */
  payoutAddress: string | null;
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

export interface DashboardSession {
  /** ISO 8601 time the session cookie expires. */
  expiresAt: string;
}

export type PaymentStatus = "open" | "processing" | "paid" | "partially_paid" | "expired" | "canceled";

export interface CreatePaymentParams {
  /** USD price, up to 2 decimals, e.g. "10" or "10.50". */
  amount: string;
  description?: string;
  /** Your order id. */
  reference?: string;
  customerId?: string;
  /** Default 30. */
  expiresInMinutes?: number;
}

export interface PaymentLeg {
  legId: string;
  quoteId: string;
  originChainId: number;
  token: { symbol: string; address: string; decimals: number; isNative: boolean };
  amountIn: string;
  estimatedOut: string | null;
  minOut: string | null;
  /** What this leg is guaranteed to cover, in cents. */
  valueCents: number;
  payer: string;
  expiresAt: number;
  status: IntentStatus | "QUOTED";
  originTx: string | null;
  destTx: string | null;
}

export interface Payment {
  paymentId: string;
  merchantName: string;
  branding: CheckoutBranding;
  amountCents: number;
  currency: string;
  description: string | null;
  reference: string | null;
  customerId: string | null;
  status: PaymentStatus;
  paidCents: number;
  pendingCents: number;
  remainingCents: number;
  /** Expired after part was paid: you hold the funds and owe the customer this much. */
  refundOwedCents: number;
  /** Who to refund (each settled part's paying wallet and value) when refundOwedCents > 0. */
  refunds: { payer: string; valueCents: number; legId: string }[];
  destChainId: number;
  payoutAddress: string;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  legs: PaymentLeg[];
}

export type CheckoutTextKey =
  | "title"
  | "connectButton"
  | "connectHint"
  | "payWithLabel"
  | "payButton"
  | "totalLabel"
  | "remainingLabel"
  | "keepOpen"
  | "emptyBalances"
  | "successTitle"
  | "successMessage"
  | "footer";

/** Checkout branding; texts accept {amount} and {merchant}. */
export interface CheckoutBranding {
  displayName?: string | null;
  /** data:image/(png|jpeg|webp|svg+xml);base64,… under 300 KB. */
  logo?: string | null;
  accentColor?: string;
  theme?: "light" | "dark" | "auto";
  radius?: number;
  showNetworkDetails?: boolean;
  texts?: Partial<Record<CheckoutTextKey, string>>;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  /** whsec_… signing secret for verifyWebhook. */
  secret: string;
  active: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  type: string;
  status: "pending" | "succeeded" | "failed";
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  paymentId: string | null;
  createdAt: string;
  deliveredAt: string | null;
  nextAttemptAt: string | null;
}
