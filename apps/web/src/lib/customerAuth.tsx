import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CustomerClient, type CustomerSession } from "stableflowr-sdk";
import { GATEWAY_URL } from "./env";
import { readStored, writeStored } from "./storage";

/**
 * End-customer session (cs_… token), separate from the partner's API key.
 * Same localStorage tradeoff as the dashboard; sessions expire after 7 days.
 */
export const CUSTOMER_SESSION_STORAGE = "arc-gateway.customerSession";
/** Remembered so the login page knows which business the customer belongs to. */
export const CUSTOMER_PARTNER_STORAGE = "arc-gateway.customerPartner";

interface CustomerAuthState {
  sessionToken: string | null;
  client: CustomerClient;
  start: (session: CustomerSession) => void;
  logout: () => void;
}

const Ctx = createContext<CustomerAuthState | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sessionToken, setSessionToken] = useState(() => readStored(CUSTOMER_SESSION_STORAGE));

  const start = useCallback(
    (session: CustomerSession) => {
      queryClient.removeQueries({ queryKey: ["customer"] });
      queryClient.setQueryData(["customer", "me", session.sessionToken], session.account);
      writeStored(CUSTOMER_SESSION_STORAGE, session.sessionToken);
      writeStored(CUSTOMER_PARTNER_STORAGE, session.account.partnerId);
      setSessionToken(session.sessionToken);
    },
    [queryClient]
  );

  const logout = useCallback(() => {
    writeStored(CUSTOMER_SESSION_STORAGE, null);
    setSessionToken(null);
    queryClient.removeQueries({ queryKey: ["customer"] });
  }, [queryClient]);

  const value = useMemo(
    () => ({
      sessionToken,
      client: new CustomerClient({ baseUrl: GATEWAY_URL, sessionToken: sessionToken ?? undefined }),
      start,
      logout,
    }),
    [sessionToken, start, logout]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCustomerAuth(): CustomerAuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCustomerAuth must be used inside <CustomerAuthProvider>");
  return ctx;
}
