import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GatewayError, type DashboardCredentials, type GatewayClient, type PartnerProfile } from "stableflow-sdk";
import { sessionClient } from "./gateway";
import { readStored, writeStored } from "./storage";

/**
 * Dashboard auth: the partner's secret key is exchanged once for an httpOnly
 * session cookie (POST /v1/dashboard/session) and then forgotten, so scripts
 * on this origin can't read it. Whether we're signed in is only known by
 * asking the gateway (GET /v1/partners/me), hence the "checking" state.
 */

/** Where builds before cookie sessions kept the raw key; migrated once, then cleared. */
export const LEGACY_API_KEY_STORAGE = "arc-gateway.apiKey";

export type AuthStatus = "checking" | "signedIn" | "signedOut";

interface AuthState {
  status: AuthStatus;
  /** Signed-in partner; scopes cached queries so accounts never share data. */
  partnerId: string | null;
  client: GatewayClient;
  /** Opens a session (email + password, or a secret key), loads the profile, and signs in. */
  login: (credentials: DashboardCredentials) => Promise<PartnerProfile>;
  logout: () => void;
  /**
   * A secret key the dashboard must show once (just after signup). Memory
   * only: a reload drops it, and the partner can rotate from Settings.
   */
  revealKey: string | null;
  setRevealKey: (key: string | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export class LoginError extends Error {}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  // A logout still in flight could clear a cookie set by a quick re-login.
  const pendingLogout = useRef<Promise<unknown>>(Promise.resolve());

  const signIn = useCallback(
    (profile: PartnerProfile) => {
      queryClient.setQueryData(["me", profile.partnerId], profile);
      setPartnerId(profile.partnerId);
      setStatus("signedIn");
    },
    [queryClient]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const legacyKey = readStored(LEGACY_API_KEY_STORAGE);
      if (legacyKey) {
        writeStored(LEGACY_API_KEY_STORAGE, null);
        await sessionClient.openDashboardSession(legacyKey).catch(() => undefined);
      }
      try {
        const profile = await sessionClient.me();
        // A response without a partner isn't a session (proxies, captive portals, bad mocks).
        if (!profile?.partnerId) throw new Error("no partner in profile");
        if (!cancelled) signIn(profile);
      } catch {
        if (!cancelled) setStatus("signedOut");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signIn]);

  const login = useCallback(
    async (credentials: DashboardCredentials) => {
      const byKey = "apiKey" in credentials;
      const creds: DashboardCredentials = byKey
        ? { apiKey: credentials.apiKey.trim() }
        : { email: credentials.email.trim(), password: credentials.password };
      if ("apiKey" in creds && !creds.apiKey) throw new LoginError("Enter your API key.");
      if ("email" in creds && (!creds.email || !creds.password)) throw new LoginError("Enter your email and password.");
      await pendingLogout.current;
      try {
        await sessionClient.openDashboardSession(creds);
      } catch (err) {
        if (err instanceof GatewayError) {
          if (err.statusCode === 401 && !byKey) throw new LoginError("That email and password don't match.");
          if (err.statusCode === 429) throw new LoginError("Too many attempts. Wait 15 minutes and try again.");
          if (err.statusCode === 400 && byKey) {
            throw new LoginError("This key isn't linked to a partner account. Use the key from signup.");
          }
          if (err.statusCode === 403) {
            throw new LoginError("That's a publishable key. Sign in with your secret key (gw_live_…).");
          }
        }
        throw err;
      }
      const profile = await sessionClient.me();
      queryClient.clear();
      signIn(profile);
      return profile;
    },
    [queryClient, signIn]
  );

  const logout = useCallback(() => {
    setStatus("signedOut");
    setPartnerId(null);
    setRevealKey(null);
    queryClient.clear();
    pendingLogout.current = sessionClient.closeDashboardSession().catch(() => undefined);
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({ status, partnerId, client: sessionClient, login, logout, revealKey, setRevealKey }),
    [status, partnerId, login, logout, revealKey]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Client for authenticated pages; only call under <RequireAuth>. */
export function useGateway(): { client: GatewayClient; scope: string } {
  const { client, partnerId, status } = useAuth();
  if (status !== "signedIn" || !partnerId) throw new Error("useGateway called without a signed-in partner");
  return { client, scope: partnerId };
}
