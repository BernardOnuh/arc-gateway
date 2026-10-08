import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GatewayError, type GatewayClient, type PartnerProfile } from "@arc/gateway-sdk";
import { createGatewayClient } from "./gateway";
import { readStored, writeStored } from "./storage";

/**
 * Dashboard auth is the partner's secret API key, kept in localStorage so a
 * reload stays signed in. Tradeoff: any script running on this origin (XSS,
 * a malicious dependency) could read it. Acceptable for the MVP; the plan is
 * to exchange the key for an httpOnly session cookie later.
 */
export const API_KEY_STORAGE = "arc-gateway.apiKey";

interface AuthState {
  apiKey: string | null;
  client: GatewayClient | null;
  /** Validates the key against GET /v1/partners/me, then stores it. */
  login: (apiKey: string) => Promise<PartnerProfile>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export class LoginError extends Error {}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState<string | null>(() => readStored(API_KEY_STORAGE));

  const login = useCallback(
    async (rawKey: string) => {
      const key = rawKey.trim();
      if (!key) throw new LoginError("Enter your API key.");
      const client = createGatewayClient(key);
      let profile: PartnerProfile;
      try {
        profile = await client.me();
      } catch (err) {
        if (err instanceof GatewayError && err.statusCode === 400) {
          throw new LoginError(
            "This key isn't linked to a partner account. Use the key from signup."
          );
        }
        throw err;
      }
      queryClient.clear();
      queryClient.setQueryData(["me", key], profile);
      writeStored(API_KEY_STORAGE, key);
      setApiKey(key);
      return profile;
    },
    [queryClient]
  );

  const logout = useCallback(() => {
    writeStored(API_KEY_STORAGE, null);
    setApiKey(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      apiKey,
      client: apiKey ? createGatewayClient(apiKey) : null,
      login,
      logout,
    }),
    [apiKey, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Client for authenticated pages; only call under <RequireAuth>. */
export function useGateway(): { client: GatewayClient; apiKey: string } {
  const { client, apiKey } = useAuth();
  if (!client || !apiKey) throw new Error("useGateway called without a signed-in partner");
  return { client, apiKey };
}
