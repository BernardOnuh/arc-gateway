import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ChainInfo,
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
