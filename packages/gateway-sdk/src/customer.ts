import { GatewayClient, type GatewayClientOptions } from "./client.js";
import type { CustomerAccount, CustomerSession } from "./types.js";

export interface CustomerClientOptions extends Omit<GatewayClientOptions, "apiKey"> {
  /** Session token (cs_…) from setup() or login(). */
  sessionToken?: string;
}

/** End-customer self-service: account setup, login, password and payout wallet. */
export class CustomerClient extends GatewayClient {
  constructor(options: CustomerClientOptions = {}) {
    const { sessionToken, ...rest } = options;
    super({ ...rest, apiKey: sessionToken });
  }

  setup(params: { token: string; email: string; password: string }): Promise<CustomerSession> {
    return this.request("POST", "/v1/customer-auth/setup", { body: params, skipAuth: true });
  }

  login(params: { partnerId: string; email: string; password: string }): Promise<CustomerSession> {
    return this.request("POST", "/v1/customer-auth/login", { body: params, skipAuth: true });
  }

  logout(): Promise<{ ok: true }> {
    return this.request("POST", "/v1/customer-auth/logout");
  }

  account(): Promise<CustomerAccount> {
    return this.request("GET", "/v1/customer/me");
  }

  changePassword(params: { currentPassword: string; newPassword: string }): Promise<CustomerAccount> {
    return this.request("POST", "/v1/customer/me/password", { body: params });
  }

  setPayoutWallet(params: { address: string; chainId: number }): Promise<CustomerAccount> {
    return this.request("POST", "/v1/customer/me/wallet", { body: params });
  }
}
