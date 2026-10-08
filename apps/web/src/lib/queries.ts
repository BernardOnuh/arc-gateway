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
  const { client, apiKey } = useGateway();
  return useQuery({ queryKey: ["me", apiKey], queryFn: () => client.me() });
}

export function useLedger(customerId?: string) {
  const { client, apiKey } = useGateway();
  return useQuery({
    queryKey: ["ledger", apiKey, customerId ?? null],
    queryFn: () => client.ledger(customerId),
  });
}

export function useCustomers(params: PageParams) {
  const { client, apiKey } = useGateway();
  return useQuery({
    queryKey: ["customers", apiKey, params],
    queryFn: () => client.listCustomers(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateCustomer() {
  const { client, apiKey } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateCustomerParams) => client.createCustomer(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers", apiKey] });
      void queryClient.invalidateQueries({ queryKey: ["ledger", apiKey] });
    },
  });
}

const ACTIVE_STATUSES = new Set(["PENDING", "ORIGIN_CONFIRMED", "FILLED"]);

export function useQuotes(params: ListQuotesParams) {
  const { client, apiKey } = useGateway();
  return useQuery({
    queryKey: ["quotes", apiKey, params],
    queryFn: () => client.listQuotes(params),
    placeholderData: keepPreviousData,
    // Keep in-flight intents moving without a manual refresh.
    refetchInterval: (q) =>
      q.state.data?.items.some((i) => i.intent && ACTIVE_STATUSES.has(i.intent.status)) ? 10_000 : false,
  });
}

export function useIntents(params: ListIntentsParams) {
  const { client, apiKey } = useGateway();
  return useQuery({
    queryKey: ["intents", apiKey, params],
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
