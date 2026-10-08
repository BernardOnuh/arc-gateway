import { QueryClient } from "@tanstack/react-query";
import { GatewayError } from "@arc/gateway-sdk";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        // 4xx answers won't change on retry; only retry network/5xx failures.
        retry: (count, err) =>
          !(err instanceof GatewayError && err.statusCode >= 400 && err.statusCode < 500) &&
          count < 2,
        // Keep tests fast; real users get react-query's exponential backoff.
        ...(import.meta.env.MODE === "test" ? { retryDelay: 0 } : {}),
      },
    },
  });
}
