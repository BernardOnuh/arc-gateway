import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createApi } from "../api.js";
import { accentForeground, normalizeAccent } from "../ArcSwapWidget.js";
import { checkoutCss, widgetCss } from "../styles.js";
import { formatUnits } from "../units.js";
import { appKitExecute } from "./execute.js";
import type {
  ArcCheckoutProps,
  CheckoutBranding,
  CheckoutChain,
  CheckoutTextKey,
  Eip1193Provider,
  Holding,
  Payment,
  PaymentLeg,
  PriceItem,
} from "./types.js";
import { amountForCents, connectWallet, injectedProvider, isUserRejection, readHoldings } from "./wallet.js";

/** Defaults for every customer-facing string; merchants override any of them. */
export const DEFAULT_CHECKOUT_TEXTS: Record<CheckoutTextKey, string> = {
  title: "Pay",
  connectButton: "Connect wallet",
  connectHint: "Pay with tokens you already hold, from any of your networks.",
  payWithLabel: "Pay with",
  payButton: "Pay {amount}",
  totalLabel: "Total",
  remainingLabel: "Remaining",
  keepOpen: "Keep this window open until the payment completes.",
  emptyBalances: "No supported tokens in this wallet. Add funds or connect another wallet.",
  successTitle: "Payment complete",
  successMessage: "{amount} paid to {merchant}",
  footer: "Secured by ARC Gateway",
};

/** Only data:image/* or https URLs reach an <img src>. */
const safeLogo = (logo: string | null | undefined) =>
  logo && (/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(logo) || /^https:\/\//.test(logo)) ? logo : null;

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type StepState = "waiting" | "active" | "done" | "failed";
interface Step {
  key: string;
  label: string;
  cents: number;
  state: StepState;
  detail: string;
  legId?: string;
}

type View =
  | { name: "connect" }
  | { name: "select" }
  | { name: "paying"; steps: Step[] }
  | { name: "done" };

const Check = ({ size = 12 }: { size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
const Spinner = () => <span aria-hidden className="arcw-spin" />;

/** Demo data: a plausible wallet, priced with the gateway's reference prices. */
const DEMO_HOLDINGS: { chainId: number; chainName: string; symbol: string; decimals: number; isNative: boolean; amount: number; priceUsd: number }[] = [
  { chainId: 8453, chainName: "Base", symbol: "USDC", decimals: 6, isNative: false, amount: 6.2, priceUsd: 1 },
  { chainId: 1, chainName: "Ethereum", symbol: "ETH", decimals: 18, isNative: true, amount: 0.0031, priceUsd: 2500 },
  { chainId: 8453, chainName: "Base", symbol: "ETH", decimals: 18, isNative: true, amount: 0.0012, priceUsd: 2500 },
  { chainId: 1, chainName: "Ethereum", symbol: "USDT", decimals: 6, isNative: false, amount: 2.5, priceUsd: 1 },
];

function demoHoldings(): Holding[] {
  return DEMO_HOLDINGS.map((d) => {
    const usdValue = d.amount * d.priceUsd;
    return {
      key: `${d.chainId}:${d.symbol}`,
      chainId: d.chainId,
      chainName: d.chainName,
      token: { chainId: d.chainId, symbol: d.symbol, address: d.symbol, decimals: d.decimals, isNative: d.isNative, priceUsd: d.priceUsd },
      balance: BigInt(Math.round(d.amount * 10 ** Math.min(d.decimals, 12))) * 10n ** BigInt(Math.max(0, d.decimals - 12)),
      usd: usdValue,
      maxCents: Math.floor((d.isNative ? Math.max(0, usdValue - 0.75) : usdValue) * 100),
    };
  }).sort((a, b) => b.usd - a.usd);
}

/**
 * Pay-with-any-token checkout. The customer sees a price, picks one or more
 * tokens from their wallet to cover it, and confirms each in their wallet.
 * Settlement (USDC on ARC to the merchant) stays behind the scenes unless
 * showNetworkDetails is on.
 */
export function ArcCheckout(props: ArcCheckoutProps) {
  const {
    publishableKey,
    baseUrl = "http://localhost:3000",
    paymentId,
    theme = "light",
    title,
    slippageBps = 50,
    pollIntervalMs = 3000,
    showNetworkDetails = false,
  } = props;
  const demo = !paymentId && props.demo ? props.demo : null;
  const previewState = demo ? props.previewState : undefined;
  const api = useMemo(() => createApi(baseUrl, publishableKey), [baseUrl, publishableKey]);
  const cb = useRef(props);
  cb.current = props;

  const [payment, setPayment] = useState<Payment | null>(null);

  // Branding: explicit props > branding prop > the business's saved branding > defaults.
  const brand: CheckoutBranding = { ...(payment?.branding ?? {}), ...(props.branding ?? {}) };
  const accent = normalizeAccent(props.accentColor ?? brand.accentColor);
  const radius = props.radius ?? brand.radius;
  const themeName = props.theme ?? brand.theme ?? theme;
  const networkDetails = props.showNetworkDetails ?? brand.showNetworkDetails ?? showNetworkDetails;
  const merchant = props.branding?.displayName || payment?.merchantName || "";
  const logo = safeLogo(brand.logo);
  const texts = { ...DEFAULT_CHECKOUT_TEXTS };
  for (const [k, v] of Object.entries({ ...(payment?.branding?.texts ?? {}), ...(props.branding?.texts ?? {}) })) {
    // Empty means "use the default", except the footer, where empty hides it.
    if (typeof v === "string" && (v.trim() || k === "footer")) texts[k as CheckoutTextKey] = v;
  }
  if (title) texts.title = title;
  const t = (key: CheckoutTextKey, amountCents?: number) =>
    texts[key].replaceAll("{merchant}", merchant).replaceAll("{amount}", amountCents === undefined ? "" : usd(amountCents));
  const rootStyle = {
    "--arcw-accent": accent,
    "--arcw-accent-fg": accentForeground(accent),
    "--arcw-r": `${radius === undefined ? 20 : Math.min(32, Math.max(0, radius))}px`,
  } as CSSProperties;
  const [chains, setChains] = useState<CheckoutChain[]>([]);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ name: "connect" });
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const report = useCallback((err: unknown) => {
    const e = asError(err);
    setError(e.message);
    cb.current.onError?.(e);
  }, []);

  // Load the payment (or the demo stand-in), chains and prices.
  useEffect(() => {
    let cancelled = false;
    if (demo) {
      setPayment({
        paymentId: "demo",
        merchantName: demo.merchantName,
        amountCents: demo.amountCents,
        currency: "USD",
        description: demo.description ?? null,
        reference: null,
        status: "open",
        paidCents: 0,
        pendingCents: 0,
        remainingCents: demo.amountCents,
        destChainId: 5042,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        paidAt: null,
        legs: [],
      });
      setView({ name: "connect" });
      setAccount(null);
      setHoldings(null);
      setAlloc({});
      setError(null);
      setLoadError(null);
      if (previewState) applyPreview(previewState, demo);
      return;
    }
    if (!paymentId) {
      setLoadError("No payment to show. Pass a paymentId from your server.");
      return;
    }
    Promise.all([api.payment(paymentId), api.checkoutChains(), api.prices()])
      .then(([p, c, pr]) => {
        if (cancelled) return;
        setPayment(p);
        setChains(c);
        setPrices(pr.items);
        if (p.status === "paid") setView({ name: "done" });
      })
      .catch((e) => !cancelled && setLoadError(asError(e).message));
    return () => {
      cancelled = true;
    };
    // demo object identity changes per render in most hosts; key on its values.
  }, [api, paymentId, demo?.amountCents, demo?.merchantName, demo?.description, previewState]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Demo only: jump straight to a screen with plausible data. */
  function applyPreview(state: NonNullable<typeof previewState>, d: NonNullable<typeof demo>) {
    const hs = demoHoldings();
    const account = "0x7a3f00000000000000000000000000000000e21a";
    const base: Payment = {
      paymentId: "demo",
      merchantName: d.merchantName,
      amountCents: d.amountCents,
      currency: "USD",
      description: d.description ?? null,
      reference: "order_1042",
      status: "open",
      paidCents: 0,
      pendingCents: 0,
      remainingCents: d.amountCents,
      destChainId: 5042,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      paidAt: null,
      legs: [],
    };
    const split = (need: number) => {
      const out: Record<string, number> = {};
      let left = need;
      for (const h of hs) {
        if (left <= 0) break;
        const give = Math.min(h.maxCents, left);
        if (give > 0) {
          out[h.key] = give;
          left -= give;
        }
      }
      return out;
    };
    if (state === "invalid") {
      setLoadError("This payment link isn't valid.");
      return;
    }
    if (state === "expired") {
      setPayment({ ...base, status: "expired" });
      return;
    }
    if (state === "connect") return;
    setAccount(account);
    setHoldings(hs);
    if (state === "select") {
      setAlloc(split(d.amountCents));
      setView({ name: "select" });
    } else if (state === "partial") {
      const paidCents = Math.round(d.amountCents * 0.6);
      setPayment({ ...base, status: "partially_paid", paidCents, remainingCents: d.amountCents - paidCents });
      setError(`We received ${usd(paidCents)}. Choose how to pay the remaining ${usd(d.amountCents - paidCents)}.`);
      setView({ name: "select" });
    } else if (state === "paying") {
      const parts = split(d.amountCents);
      const steps: Step[] = hs
        .filter((h) => parts[h.key])
        .map((h, i) => ({
          key: h.key,
          label: `${h.token.symbol} on ${h.chainName}`,
          cents: parts[h.key],
          state: i === 0 ? "done" : i === 1 ? "active" : "waiting",
          detail: i === 0 ? "Paid" : i === 1 ? "Confirm in your wallet" : "Waiting",
        }));
      setView({ name: "paying", steps });
    } else if (state === "done") {
      const parts = split(d.amountCents);
      setChains(DEMO_HOLDINGS.map((x) => ({ id: x.chainId, name: x.chainName, isArc: false, testnet: false, explorerUrl: "" })));
      setPayment({
        ...base,
        status: "paid",
        paidCents: d.amountCents,
        remainingCents: 0,
        paidAt: new Date().toISOString(),
        legs: hs
          .filter((h) => parts[h.key])
          .map((h, i) => ({
            legId: `demo-${i}`,
            quoteId: `demo-${i}`,
            originChainId: h.chainId,
            token: { symbol: h.token.symbol, address: h.token.address, decimals: h.token.decimals, isNative: h.token.isNative },
            amountIn: amountForCents(h, parts[h.key], slippageBps).toString(),
            valueCents: parts[h.key],
            payer: account,
            status: "EXECUTED_ON_ARC" as const,
            originTx: null,
            destTx: `0x${"ab".repeat(32)}`,
            execution: { fromChain: null, toChain: null, tokenIn: h.token.symbol, tokenOut: "USDC", amountIn: "", recipientAddress: "", slippageBps },
          })),
      });
      setView({ name: "done" });
    }
  }

  const need = payment?.remainingCents ?? 0;
  const covered = Object.values(alloc).reduce((s, c) => s + c, 0);

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      if (demo) {
        await sleep(350);
        setAccount("0x7a3f00000000000000000000000000000000e21a");
        setHoldings(demoHoldings());
      } else {
        const p = props.provider ?? injectedProvider();
        if (!p) throw new Error("No browser wallet found. Install a wallet like MetaMask or Rabby, then reload.");
        const acct = await connectWallet(p);
        setProvider(p);
        setAccount(acct);
        setHoldings(null);
        setView({ name: "select" });
        setHoldings(await readHoldings(chains, prices, acct));
      }
      setView({ name: "select" });
    } catch (e) {
      report(isUserRejection(e) ? new Error("Connection cancelled in your wallet.") : e);
    } finally {
      setBusy(false);
    }
  }

  /** Select a token: allocate as much of what's still uncovered as it can pay. */
  function toggle(h: Holding) {
    setError(null);
    setAlloc((cur) => {
      if (cur[h.key] !== undefined) {
        const { [h.key]: _drop, ...rest } = cur;
        return rest;
      }
      const used = Object.values(cur).reduce((s, c) => s + c, 0);
      const give = Math.min(h.maxCents, Math.max(0, need - used));
      return { ...cur, [h.key]: give };
    });
  }

  function setCents(h: Holding, value: string) {
    const cents = Math.round(Math.max(0, Number(value.replace(/[^0-9.]/g, "")) || 0) * 100);
    setAlloc((cur) => ({ ...cur, [h.key]: Math.min(cents, h.maxCents) }));
  }

  function useMax(h: Holding) {
    setAlloc((cur) => {
      const others = Object.entries(cur).filter(([k]) => k !== h.key).reduce((s, [, c]) => s + c, 0);
      return { ...cur, [h.key]: Math.min(h.maxCents, Math.max(0, need - others)) };
    });
  }

  const pollPayment = useCallback(
    async (onLegs: (p: Payment) => void) => {
      if (!paymentId) return null;
      for (;;) {
        let p: Payment;
        try {
          p = await api.payment(paymentId);
        } catch (e) {
          cb.current.onError?.(asError(e));
          await sleep(pollIntervalMs);
          continue;
        }
        setPayment(p);
        onLegs(p);
        cb.current.onStatus?.(p);
        if (p.status !== "processing") return p;
        await sleep(pollIntervalMs);
      }
    },
    [api, paymentId, pollIntervalMs]
  );

  async function pay() {
    if (!payment || !holdings || !account) return;
    const chosen = holdings.filter((h) => (alloc[h.key] ?? 0) > 0);
    if (covered < need) return setError(`Choose tokens covering ${usd(need)}.`);
    setError(null);
    let steps: Step[] = chosen.map((h) => ({
      key: h.key,
      label: `${h.token.symbol} on ${h.chainName}`,
      cents: alloc[h.key],
      state: "waiting",
      detail: "Waiting",
    }));
    const update = (key: string, patch: Partial<Step>) => {
      steps = steps.map((s) => (s.key === key ? { ...s, ...patch } : s));
      setView({ name: "paying", steps });
    };
    setView({ name: "paying", steps });

    // Send each leg in turn; the customer confirms each one in their wallet.
    for (const h of chosen) {
      update(h.key, { state: "active", detail: "Preparing…" });
      try {
        if (demo) {
          await sleep(500);
          update(h.key, { detail: "Confirm in your wallet" });
          await sleep(900);
          update(h.key, { detail: "Processing…" });
          await sleep(800);
          update(h.key, { state: "done", detail: "Paid" });
          continue;
        }
        const leg: PaymentLeg = await api.addLeg(payment.paymentId, {
          originChainId: h.chainId,
          tokenIn: h.token.symbol,
          amountIn: amountForCents(h, alloc[h.key], slippageBps).toString(),
          payer: account,
          slippageBps,
        });
        update(h.key, { legId: leg.legId, detail: "Confirm in your wallet" });
        const exec = cb.current.executeLeg ?? appKitExecute;
        const txHash = await exec({ leg, provider: provider!, account });
        await api.legSubmitted(payment.paymentId, leg.legId, txHash);
        update(h.key, { detail: "Processing…" });
      } catch (e) {
        update(h.key, { state: "failed", detail: isUserRejection(e) ? "Cancelled in your wallet" : asError(e).message });
        cb.current.onError?.(asError(e));
        break;
      }
    }

    if (demo) {
      // Show the simulated legs on the receipt, like a real payment.
      const legs: PaymentLeg[] = chosen.map((h, i) => ({
        legId: `demo-${i}`,
        quoteId: `demo-${i}`,
        originChainId: h.chainId,
        token: { symbol: h.token.symbol, address: h.token.address, decimals: h.token.decimals, isNative: h.token.isNative },
        amountIn: amountForCents(h, alloc[h.key], slippageBps).toString(),
        valueCents: alloc[h.key],
        payer: account,
        status: "EXECUTED_ON_ARC",
        originTx: null,
        destTx: null,
        execution: { fromChain: null, toChain: null, tokenIn: h.token.symbol, tokenOut: "USDC", amountIn: "", recipientAddress: "", slippageBps },
      }));
      setChains(DEMO_HOLDINGS.map((d) => ({ id: d.chainId, name: d.chainName, isArc: false, testnet: false, explorerUrl: "" })));
      const paid = { ...payment, legs, status: "paid" as const, paidCents: payment.amountCents, remainingCents: 0, paidAt: new Date().toISOString() };
      setPayment(paid);
      setView({ name: "done" });
      cb.current.onPaid?.(paid);
      return;
    }

    const final = await pollPayment((p) => {
      for (const leg of p.legs) {
        const step = steps.find((s) => s.legId === leg.legId);
        if (!step || step.state === "failed") continue;
        if (leg.status === "EXECUTED_ON_ARC") update(step.key, { state: "done", detail: "Paid" });
        else if (leg.status === "FAILED" || leg.status === "REFUNDED") update(step.key, { state: "failed", detail: "Didn't go through" });
      }
    });
    if (!final) return;
    if (final.status === "paid") {
      setView({ name: "done" });
      cb.current.onPaid?.(final);
    } else {
      // Short or failed: keep what settled and let the customer cover the rest.
      setAlloc({});
      setView({ name: "select" });
      setHoldings(await readHoldings(chains, prices, account));
      setError(
        final.paidCents > 0
          ? `We received ${usd(final.paidCents)}. Choose how to pay the remaining ${usd(final.remainingCents)}.`
          : "The payment didn't go through. Nothing was charged; try again or pick another token."
      );
    }
  }

  const explorer = (chainId: number) => chains.find((c) => c.id === chainId)?.explorerUrl?.replace(/\/+$/, "");
  const chainName = (chainId: number) => chains.find((c) => c.id === chainId)?.name ?? `chain ${chainId}`;

  // ----- render -----
  let body;
  if (loadError) {
    body = (
      <p className="arcw-error" role="alert">
        {loadError}
      </p>
    );
  } else if (!payment) {
    body = (
      <p className="arcw-note" style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        <Spinner /> Loading…
      </p>
    );
  } else if (view.name === "done" || payment.status === "paid") {
    body = (
      <div className="arcc-success" aria-live="polite">
        <div className="arcc-check">
          <Check size={30} />
        </div>
        <h3>{t("successTitle", payment.amountCents)}</h3>
        <p>{t("successMessage", payment.amountCents)}</p>
        <div className="arcc-receipt">
          {payment.description && (
            <div>
              <span>For</span>
              {payment.description}
            </div>
          )}
          {payment.reference && (
            <div>
              <span>Reference</span>
              {payment.reference}
            </div>
          )}
          {payment.legs
            .filter((l) => l.status === "EXECUTED_ON_ARC")
            .map((l) => (
              <div key={l.legId}>
                <span>
                  {formatUnits(l.amountIn, l.token.decimals)} {l.token.symbol} · {chainName(l.originChainId)}
                </span>
                {usd(l.valueCents)}
              </div>
            ))}
          {networkDetails && (
            <>
              <div>
                <span>Settled as</span>USDC on ARC
              </div>
              {payment.legs
                .filter((l) => l.destTx)
                .map((l) => {
                  const base = explorer(payment.destChainId);
                  return (
                    <div key={`tx-${l.legId}`}>
                      <span>Transaction</span>
                      {base && /^0x[0-9a-fA-F]{64}$/.test(l.destTx!) ? (
                        <a href={`${base}/tx/${l.destTx}`} target="_blank" rel="noreferrer" className="arcw-mono" title={l.destTx!}>
                          {shortAddr(l.destTx!)} ↗
                        </a>
                      ) : (
                        <span className="arcw-mono">{shortAddr(l.destTx!)}</span>
                      )}
                    </div>
                  );
                })}
            </>
          )}
        </div>
      </div>
    );
  } else if (payment.status === "expired") {
    body = (
      <p className="arcw-error" role="alert">
        This payment expired. Go back to {merchant} to start again.
      </p>
    );
  } else if (view.name === "connect") {
    body = (
      <>
        {error && (
          <p className="arcw-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="arcw-btn" onClick={connect} disabled={busy}>
          {busy ? (
            <>
              <Spinner /> Connecting…
            </>
          ) : (
            t("connectButton")
          )}
        </button>
        {texts.connectHint.trim() && <p className="arcw-note">{t("connectHint")}</p>}
      </>
    );
  } else if (view.name === "select") {
    const full = covered >= need && need > 0;
    body = (
      <>
        <div className="arcc-section">
          <span>{t("payWithLabel")}</span>
          {account && <span className="arcc-account">{shortAddr(account)}</span>}
        </div>
        {holdings === null ? (
          <p className="arcw-note" style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            <Spinner /> Checking your balances…
          </p>
        ) : holdings.length === 0 ? (
          <div className="arcc-empty">{t("emptyBalances")}</div>
        ) : (
          <ul className="arcc-list" aria-label="Your balances">
            {holdings.map((h) => {
              const on = alloc[h.key] !== undefined;
              const disabled = h.maxCents <= 0;
              const id = `arcc-${h.key.replace(/[^a-z0-9]/gi, "")}`;
              return (
                <li key={h.key}>
                  <label className="arcc-row" data-on={on ? "" : undefined} aria-disabled={disabled} htmlFor={id}>
                    <span className="arcc-row-main">
                      <input id={id} type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(h)} />
                      <span className="arcc-coin" aria-hidden>
                        {h.token.symbol.slice(0, 4)}
                        <i>{h.chainName.slice(0, 1)}</i>
                      </span>
                      <span className="arcc-name">
                        <b>{h.token.symbol}</b>
                        <span>{h.chainName}</span>
                      </span>
                      <span className="arcc-val">
                        <b>{usd(Math.floor(h.usd * 100))}</b>
                        <span>
                          {formatUnits(h.balance.toString(), h.token.decimals, 5)} {h.token.symbol}
                        </span>
                      </span>
                    </span>
                  </label>
                  {on && (
                    <div className="arcc-use">
                      Use
                      <input
                        className="arcw-input"
                        inputMode="decimal"
                        aria-label={`Amount of ${h.token.symbol} on ${h.chainName} in dollars`}
                        value={(alloc[h.key] / 100).toFixed(2)}
                        onChange={(e) => setCents(h, e.target.value)}
                      />
                      <button type="button" className="arcw-link" onClick={() => useMax(h)}>
                        Max
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="arcc-cover">
          <div className="arcc-cover-top">
            <span>
              Covered <b>{usd(Math.min(covered, need))}</b> of {usd(need)}
            </span>
            {!full && need > covered && <span>{usd(need - covered)} left</span>}
          </div>
          <div className="arcc-bar" data-full={full ? "" : undefined} aria-hidden>
            <i style={{ width: `${need ? Math.min(100, (covered / need) * 100) : 0}%` }} />
          </div>
        </div>
        {error && (
          <p className="arcw-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="arcw-btn" disabled={!full || busy} onClick={pay}>
          {t("payButton", need)}
        </button>
      </>
    );
  } else {
    body = (
      <div aria-live="polite">
        <ul className="arcc-steps">
          {view.steps.map((s) => (
            <li key={s.key} className="arcc-step" data-state={s.state}>
              <span className="arcw-dot">
                {s.state === "done" ? <Check /> : s.state === "active" ? <Spinner /> : s.state === "failed" ? "!" : null}
              </span>
              <span className="arcc-step-text">
                <b>
                  {usd(s.cents)} in {s.label}
                </b>
                <span>{s.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        {texts.keepOpen.trim() && <p className="arcw-note">{t("keepOpen")}</p>}
      </div>
    );
  }

  return (
    <div className="arcw" data-theme={themeName} style={rootStyle} data-testid="arc-checkout">
      <style>
        {widgetCss}
        {checkoutCss}
      </style>
      {payment && (
        <>
          <div className="arcc-merchant">
            {logo ? (
              <img className="arcc-logo" src={logo} alt="" />
            ) : (
              <span className="arcc-avatar" aria-hidden>
                {merchant.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span>
              <small>{t("title")}</small>
              <strong>{merchant}</strong>
            </span>
          </div>
          {view.name !== "done" && payment.status !== "paid" && (
            <div className="arcc-total">
              <small>{payment.paidCents > 0 ? t("remainingLabel") : t("totalLabel")}</small>
              <strong>{usd(payment.paidCents > 0 ? payment.remainingCents : payment.amountCents)}</strong>
              {payment.description && <p>{payment.description}</p>}
            </div>
          )}
        </>
      )}
      {body}
      {texts.footer.trim() && <p className="arcw-foot">{t("footer")}</p>}
    </div>
  );
}
