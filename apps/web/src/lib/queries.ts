import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ChainInfo,
  CheckoutBranding,
  CreatePaymentParams,
  CreateCustomerParams,
  ListIntentsParams,
  ListQuotesParams,
  PageParams,
  TokenInfo,
} from "@arc/gateway-sdk";
import { useGateway } from "./auth";
import { publicClient } from "./gateway";

export function usePartnerProfile() {
  const { client, scope } = useGateway();
  return useQuery({ queryKey: ["me", scope], queryFn: () => client.me() });
}

export function useLedger(customerId?: string) {
  const { client, scope } = useGateway();
  return useQuery({
    queryKey: ["ledger", scope, customerId ?? null],
    queryFn: () => client.ledger(customerId),
  });
}

export function useCustomers(params: PageParams) {
  const { client, scope } = useGateway();
  return useQuery({
    queryKey: ["customers", scope, params],
    queryFn: () => client.listCustomers(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateCustomer() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateCustomerParams) => client.createCustomer(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers", scope] });
      void queryClient.invalidateQueries({ queryKey: ["ledger", scope] });
    },
  });
}

const ACTIVE_STATUSES = new Set(["PENDING", "ORIGIN_CONFIRMED", "FILLED"]);

export function useQuotes(params: ListQuotesParams) {
  const { client, scope } = useGateway();
  return useQuery({
    queryKey: ["quotes", scope, params],
    queryFn: () => client.listQuotes(params),
    placeholderData: keepPreviousData,
    // Keep in-flight intents moving without a manual refresh.
    refetchInterval: (q) =>
      q.state.data?.items.some((i) => i.intent && ACTIVE_STATUSES.has(i.intent.status)) ? 10_000 : false,
  });
}

export function useIntents(params: ListIntentsParams) {
  const { client, scope } = useGateway();
  return useQuery({
    queryKey: ["intents", scope, params],
    queryFn: () => client.listIntents(params),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.items.some((i) => ACTIVE_STATUSES.has(i.status)) ? 10_000 : false),
  });
}

export interface Catalog {
  chain: (id: number) => ChainInfo | undefined;
  /** Look up a token by chain and the symbol or address the partner sent. */
  token: (chainId: number, symbolOrAddress: string) => TokenInfo | undefined;
}

/** Public chain/token registry, used to label amounts and link explorers. */
export function useCatalog(): Catalog {
  const chains = useQuery({ queryKey: ["public", "chains"], queryFn: () => publicClient.chains(), staleTime: Infinity });
  const tokens = useQuery({ queryKey: ["public", "tokens"], queryFn: () => publicClient.tokens(), staleTime: Infinity });
  return {
    chain: (id) => chains.data?.find((c) => c.id === id),
    token: (chainId, value) => {
      const v = value.toLowerCase();
      return tokens.data?.find(
        (t) => t.chainId === chainId && (t.address.toLowerCase() === v || t.symbol.toLowerCase() === v)
      );
    },
  };
}

export function useApiKeys() {
  const { client, scope } = useGateway();
  return useQuery({ queryKey: ["api-keys", scope], queryFn: () => client.listApiKeys() });
}

export function useCreatePublishableKey() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (allowedOrigins: string[]) => client.createPublishableKey({ allowedOrigins }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["api-keys", scope] }),
  });
}

export function useRevokeApiKey() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => client.revokeApiKey(keyId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["api-keys", scope] }),
  });
}

export function useCreateSetupLink() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (customerId: string) => client.createSetupLink(customerId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["customers", scope] }),
  });
}

export function useSetPassword() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { currentPassword?: string; newPassword: string }) => client.setPassword(params),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["me", scope] }),
  });
}

export function usePayments(params: PageParams) {
  const { client, scope } = useGateway();
  return useQuery({
    queryKey: ["payments", scope, params],
    queryFn: () => client.listPayments(params),
    placeholderData: keepPreviousData,
    // Keep in-flight payments moving.
    refetchInterval: (q) => (q.state.data?.items.some((p) => p.status === "processing") ? 5_000 : false),
  });
}

export function useCreatePayment() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreatePaymentParams) => client.createPayment(params),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["payments", scope] }),
  });
}

export function useSetPayoutAddress() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (address: string) => client.setPayoutAddress(address),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["me", scope] }),
  });
}

export function useBranding() {
  const { client, scope } = useGateway();
  return useQuery({ queryKey: ["branding", scope], queryFn: () => client.getBranding() });
}

export function useSaveBranding() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branding: CheckoutBranding) => client.updateBranding(branding),
    onSuccess: (saved) => queryClient.setQueryData(["branding", scope], saved),
  });
}

export function useWebhooks() {
  const { client, scope } = useGateway();
  return useQuery({ queryKey: ["webhooks", scope], queryFn: () => client.listWebhooks() });
}

export function useWebhookEvents(id: string | null) {
  const { client, scope } = useGateway();
  return useQuery({
    queryKey: ["webhook-events", scope, id],
    queryFn: () => client.listWebhookEvents(id!),
    enabled: Boolean(id),
    refetchInterval: 10_000,
  });
}

export function useCreateWebhook() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => client.createWebhook(url),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["webhooks", scope] }),
  });
}

export function useDeleteWebhook() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.deleteWebhook(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["webhooks", scope] }),
  });
}

export function useTestWebhook() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.testWebhook(id),
    onSuccess: (_r, id) => void queryClient.invalidateQueries({ queryKey: ["webhook-events", scope, id] }),
  });
}
