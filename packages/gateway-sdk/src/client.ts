import { GatewayError } from "./errors.js";
import type {
  ApiKeySummary,
  ChainInfo,
  CreatePublishableKeyParams,
  CreateCustomerParams,
  Customer,
  DashboardSession,
  Intent,
  IntentListItem,
  Ledger,
  ListIntentsParams,
  ListQuotesParams,
  Page,
  PageParams,
  PartnerProfile,
  Quote,
  QuoteListItem,
  QuoteParams,
  RegisterPartnerParams,
  RotateApiKeyResult,
  SetupLink,
  RegisterPartnerResult,
  SubmitIntentParams,
  SubmitIntentResult,
  TokenInfo,
} from "./types.js";

export interface GatewayClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /** Browser only: "include" sends the dashboard session cookie cross-origin. */
  credentials?: RequestCredentials;
  /** Extra headers on every request (e.g. x-arc-dashboard for cookie sessions). */
  headers?: Record<string, string>;
}

export interface PollOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  onUpdate?: (intent: Intent) => void;
}

export class GatewayClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly credentials?: RequestCredentials;
  private readonly extraHeaders: Record<string, string>;
  readonly apiKey?: string;

  constructor(options: GatewayClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:3000").replace(/\/+$/, "");
    // Wrap the global so it is never invoked with the client as `this`:
    // browsers throw "Illegal invocation" for a detached window.fetch.
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.apiKey = options.apiKey;
    this.credentials = options.credentials;
    this.extraHeaders = options.headers ?? {};
  }

  protected resolveKey(apiKey?: string): string | undefined {
    return apiKey ?? this.apiKey;
  }

  protected async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
      apiKey?: string;
      skipAuth?: boolean;
    } = {}
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (options.query) {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) search.set(key, String(value));
      }
      const qs = search.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = { ...this.extraHeaders };
    if (!options.skipAuth) {
      const key = this.resolveKey(options.apiKey);
      if (key) headers.authorization = `Bearer ${key}`;
    }
    if (options.body !== undefined) headers["content-type"] = "application/json";

    const res = await this.fetchImpl(url, {
      method,
      headers,
      ...(this.credentials ? { credentials: this.credentials } : {}),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      throw new GatewayError(res.status, data, url);
    }
    return data as T;
  }

  registerPartner(params: RegisterPartnerParams): Promise<RegisterPartnerResult> {
    return this.request("POST", "/v1/partners", { body: params, skipAuth: true });
  }

  /** Exchanges a secret key for an httpOnly session cookie (browser dashboards). */
  openDashboardSession(apiKey: string): Promise<DashboardSession> {
    return this.request("POST", "/v1/dashboard/session", { body: { apiKey }, skipAuth: true });
  }

  closeDashboardSession(): Promise<{ ok: true }> {
    return this.request("POST", "/v1/dashboard/session/logout", { skipAuth: true });
  }

  me(apiKey?: string): Promise<PartnerProfile> {
    return this.request("GET", "/v1/partners/me", { apiKey });
  }

  listApiKeys(apiKey?: string): Promise<{ items: ApiKeySummary[] }> {
    return this.request("GET", "/v1/partners/me/api-keys", { apiKey });
  }

  /** Issues a new secret key and revokes the one used for this call. */
  rotateApiKey(apiKey?: string): Promise<RotateApiKeyResult> {
    return this.request("POST", "/v1/partners/me/api-keys/rotate", { apiKey });
  }

  createPublishableKey(params: CreatePublishableKeyParams, apiKey?: string): Promise<ApiKeySummary> {
    return this.request("POST", "/v1/partners/me/api-keys/publishable", { body: params, apiKey });
  }

  revokeApiKey(keyId: string, apiKey?: string): Promise<ApiKeySummary> {
    return this.request("POST", "/v1/partners/me/api-keys/revoke", { body: { keyId }, apiKey });
  }

  /** One-time token for the customer to set their password (no email is sent). */
  createSetupLink(customerId: string, apiKey?: string): Promise<SetupLink> {
    return this.request("POST", `/v1/customers/${encodeURIComponent(customerId)}/setup-link`, { apiKey });
  }

  createCustomer(params: CreateCustomerParams, apiKey?: string): Promise<Customer> {
    return this.request("POST", "/v1/customers", { body: params, apiKey });
  }

  listCustomers(params: PageParams = {}, apiKey?: string): Promise<Page<Customer>> {
    return this.request("GET", "/v1/customers", { query: { ...params }, apiKey });
  }

  listQuotes(params: ListQuotesParams = {}, apiKey?: string): Promise<Page<QuoteListItem>> {
    return this.request("GET", "/v1/quotes", { query: { ...params }, apiKey });
  }

  listIntents(params: ListIntentsParams = {}, apiKey?: string): Promise<Page<IntentListItem>> {
    return this.request("GET", "/v1/intents", { query: { ...params }, apiKey });
  }

  quote(params: QuoteParams, apiKey?: string): Promise<Quote> {
    return this.request("POST", "/v1/quotes", { body: params, apiKey });
  }

  submitIntent(params: SubmitIntentParams, apiKey?: string): Promise<SubmitIntentResult> {
    return this.request("POST", "/v1/intents/submit", { body: params, apiKey });
  }

  getIntent(id: string, apiKey?: string): Promise<Intent> {
    return this.request("GET", `/v1/intents/${encodeURIComponent(id)}`, { apiKey });
  }

  ledger(customerId?: string, apiKey?: string): Promise<Ledger> {
    return this.request("GET", "/v1/ledger", { query: { customerId }, apiKey });
  }

  chains(): Promise<ChainInfo[]> {
    return this.request("GET", "/v1/chains");
  }

  tokens(chainId?: number): Promise<TokenInfo[]> {
    return this.request("GET", "/v1/tokens", { query: { chainId } });
  }

  async submitAndPoll(
    params: SubmitIntentParams,
    options: PollOptions = {},
    apiKey?: string
  ): Promise<Intent> {
    const { intentId } = await this.submitIntent(params, apiKey);
    const interval = options.pollIntervalMs ?? 2000;
    const deadline = Date.now() + (options.timeoutMs ?? 60_000);
    for (;;) {
      const intent = await this.getIntent(intentId, apiKey);
      options.onUpdate?.(intent);
      if (
        intent.status === "EXECUTED_ON_ARC" ||
        intent.status === "FAILED" ||
        intent.status === "REFUNDED"
      ) {
        return intent;
      }
      if (Date.now() > deadline) {
        throw new GatewayError(0, { error: "intent poll timed out" }, `/v1/intents/${intentId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}