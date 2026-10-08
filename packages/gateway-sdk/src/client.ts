import { GatewayError } from "./errors.js";
import type {
  ChainInfo,
  CreateCustomerParams,
  Customer,
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
  RegisterPartnerResult,
  SubmitIntentParams,
  SubmitIntentResult,
  TokenInfo,
} from "./types.js";

export interface GatewayClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export interface PollOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  onUpdate?: (intent: Intent) => void;
}

export class GatewayClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  readonly apiKey?: string;

  constructor(options: GatewayClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:3000").replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiKey = options.apiKey;
  }

  private resolveKey(apiKey?: string): string | undefined {
    return apiKey ?? this.apiKey;
  }

  private async request<T>(
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

    const headers: Record<string, string> = {};
    if (!options.skipAuth) {
      const key = this.resolveKey(options.apiKey);
      if (key) headers.authorization = `Bearer ${key}`;
    }
    if (options.body !== undefined) headers["content-type"] = "application/json";

    const res = await this.fetchImpl(url, {
      method,
      headers,
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

  me(apiKey?: string): Promise<PartnerProfile> {
    return this.request("GET", "/v1/partners/me", { apiKey });
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