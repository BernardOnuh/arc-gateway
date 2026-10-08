import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createApi, WidgetApiError } from "./api.js";
import { widgetCss } from "./styles.js";
import { TERMINAL_STATUSES, type ArcSwapWidgetProps, type Chain, type Intent, type Token, type WidgetQuote } from "./types.js";
import { formatUnits, parseUnits } from "./units.js";

const STEPS: { status: Intent["status"]; label: string }[] = [
  { status: "PENDING", label: "Submitted" },
  { status: "ORIGIN_CONFIRMED", label: "Confirmed on source chain" },
  { status: "FILLED", label: "Filled" },
  { status: "EXECUTED_ON_ARC", label: "Delivered on ARC" },
];

type Phase =
  | { name: "form" }
  | { name: "quoted"; quote: WidgetQuote }
  | { name: "tracking"; quote: WidgetQuote; intentId: string; intent: Intent | null };

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

export function ArcSwapWidget(props: ArcSwapWidgetProps) {
  const {
    publishableKey,
    baseUrl = "http://localhost:3000",
    recipient: fixedRecipient,
    customerId,
    slippageBps = 50,
    pollIntervalMs = 3000,
  } = props;
  const api = useMemo(() => createApi(baseUrl, publishableKey), [baseUrl, publishableKey]);
  // Callbacks change identity every render in most apps; read them from a ref.
  const cb = useRef(props);
  cb.current = props;

  const [chains, setChains] = useState<Chain[] | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [originChainId, setOriginChainId] = useState<number | null>(props.originChainId ?? null);
  const [destChainId, setDestChainId] = useState<number | null>(props.destChainId ?? null);
  const [tokenIn, setTokenIn] = useState("");
  const [tokenOut, setTokenOut] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState(fixedRecipient ?? "");
  const [phase, setPhase] = useState<Phase>({ name: "form" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = (err: unknown) => {
    const e = asError(err);
    setError(e.message);
    cb.current.onError?.(e);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.chains(), api.tokens()])
      .then(([c, t]) => {
        if (cancelled) return;
        setChains(c);
        setTokens(t);
        setOriginChainId((cur) => cur ?? c.find((x) => !x.isArc)?.id ?? null);
        setDestChainId((cur) => cur ?? (c.find((x) => x.isArc && !x.testnet) ?? c.find((x) => x.isArc))?.id ?? null);
      })
      .catch((err) => !cancelled && setLoadError(asError(err).message));
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (fixedRecipient !== undefined) setRecipient(fixedRecipient);
  }, [fixedRecipient]);

  const originTokens = tokens.filter((t) => t.chainId === originChainId);
  const destTokens = tokens.filter((t) => t.chainId === destChainId);
  // Default token picks when the chain changes.
  useEffect(() => {
    if (!originTokens.some((t) => t.symbol === tokenIn)) setTokenIn(originTokens[0]?.symbol ?? "");
  }, [originChainId, tokens]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!destTokens.some((t) => t.symbol === tokenOut))
      setTokenOut((destTokens.find((t) => t.symbol === "USDC") ?? destTokens[0])?.symbol ?? "");
  }, [destChainId, tokens]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll the intent until it reaches a terminal status.
  const trackingId = phase.name === "tracking" ? phase.intentId : null;
  useEffect(() => {
    if (!trackingId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const intent = await api.intent(trackingId);
        if (cancelled) return;
        setPhase((p) => (p.name === "tracking" && p.intentId === trackingId ? { ...p, intent } : p));
        cb.current.onStatus?.(intent);
        if (TERMINAL_STATUSES.includes(intent.status)) {
          cb.current.onIntent?.(intent);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        // Transient errors: keep polling, but tell the host.
        cb.current.onError?.(asError(err));
      }
      timer = setTimeout(tick, pollIntervalMs);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trackingId, api, pollIntervalMs]);

  async function getQuote(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const tIn = originTokens.find((t) => t.symbol === tokenIn);
    const tOut = destTokens.find((t) => t.symbol === tokenOut);
    if (originChainId === null || destChainId === null || !tIn || !tOut) return setError("Choose what to send and receive.");
    const amountIn = parseUnits(amount, tIn.decimals);
    if (!amountIn || amountIn === "0") return setError(`Enter an amount (up to ${tIn.decimals} decimals).`);
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient.trim())) return setError("Enter a valid receiving address (0x…).");
    const request = {
      originChainId,
      destChainId,
      tokenIn: tIn.symbol,
      tokenOut: tOut.symbol,
      amountIn,
      recipient: recipient.trim(),
      slippageBps,
      deadline: Math.floor(Date.now() / 1000) + 15 * 60,
      ...(customerId ? { customerId } : {}),
    };
    setBusy(true);
    try {
      const q = await api.quote(request);
      const quote: WidgetQuote = { ...q, request, tokenIn: tIn, tokenOut: tOut };
      setPhase({ name: "quoted", quote });
      cb.current.onQuote?.(quote);
    } catch (err) {
      report(err);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(quote: WidgetQuote) {
    const submit = cb.current.submitIntent;
    if (!submit) return;
    setError(null);
    if (Date.now() / 1000 > quote.expiresAt) {
      setPhase({ name: "form" });
      return setError("That quote expired. Get a new one.");
    }
    setBusy(true);
    try {
      const { intentId } = await submit(quote);
      if (!intentId) throw new Error("submitIntent did not return an intentId");
      setPhase({ name: "tracking", quote, intentId, intent: null });
    } catch (err) {
      report(err);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhase({ name: "form" });
    setError(null);
  }

  const chainName = (id: number) => chains?.find((c) => c.id === id)?.name ?? `Chain ${id}`;

  let body;
  if (loadError) {
    body = <p className="arcw-error" role="alert">{loadError}</p>;
  } else if (!chains) {
    body = <p className="arcw-note">Loading…</p>;
  } else if (phase.name === "form") {
    const sources = chains.filter((c) => !c.isArc);
    const destinations = chains.filter((c) => c.isArc);
    const tIn = originTokens.find((t) => t.symbol === tokenIn);
    body = (
      <form onSubmit={getQuote} noValidate>
        <div className="arcw-row">
          <div className="arcw-field">
            <label htmlFor="arcw-origin">From network</label>
            <select id="arcw-origin" value={originChainId ?? ""} onChange={(e) => setOriginChainId(Number(e.target.value))}>
              {sources.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="arcw-field">
            <label htmlFor="arcw-token-in">Send</label>
            <select id="arcw-token-in" value={tokenIn} onChange={(e) => setTokenIn(e.target.value)}>
              {originTokens.map((t) => (
                <option key={t.address} value={t.symbol}>{t.symbol}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="arcw-field">
          <label htmlFor="arcw-amount">Amount{tIn ? ` (${tIn.symbol})` : ""}</label>
          <input id="arcw-amount" inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="arcw-row">
          <div className="arcw-field">
            <label htmlFor="arcw-dest">To network</label>
            <select id="arcw-dest" value={destChainId ?? ""} onChange={(e) => setDestChainId(Number(e.target.value))}>
              {destinations.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="arcw-field">
            <label htmlFor="arcw-token-out">Receive</label>
            <select id="arcw-token-out" value={tokenOut} onChange={(e) => setTokenOut(e.target.value)}>
              {destTokens.map((t) => (
                <option key={t.address} value={t.symbol}>{t.symbol}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="arcw-field">
          <label htmlFor="arcw-recipient">Receiving address</label>
          <input
            id="arcw-recipient"
            className="arcw-mono"
            placeholder="0x…"
            spellCheck={false}
            readOnly={fixedRecipient !== undefined}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>
        {error && <p className="arcw-error" role="alert">{error}</p>}
        <button type="submit" className="arcw-btn" disabled={busy}>
          {busy ? "Getting quote…" : "Get quote"}
        </button>
      </form>
    );
  } else {
    const { quote } = phase;
    const { tokenIn: tIn, tokenOut: tOut } = quote;
    body = (
      <>
        <div className="arcw-summary">
          <dl>
            <dt>You send</dt>
            <dd>{formatUnits(quote.amountIn, tIn.decimals)} {tIn.symbol} on {chainName(quote.request.originChainId)}</dd>
            <dt>Fee ({(quote.feeBps / 100).toFixed(2)}%)</dt>
            <dd>{formatUnits(quote.feeAmount, tIn.decimals)} {tIn.symbol}</dd>
            <dt>You receive (est.)</dt>
            <dd>{formatUnits(quote.estimatedOut, tOut.decimals)} {tOut.symbol} on {chainName(quote.request.destChainId)}</dd>
            <dt>Minimum</dt>
            <dd>{formatUnits(quote.minOut, tOut.decimals)} {tOut.symbol}</dd>
          </dl>
        </div>
        {phase.name === "quoted" ? (
          <>
            {error && <p className="arcw-error" role="alert">{error}</p>}
            {props.submitIntent ? (
              <button type="button" className="arcw-btn" disabled={busy} onClick={() => confirm(quote)}>
                {busy ? "Submitting…" : "Confirm"}
              </button>
            ) : (
              <p className="arcw-note" role="note">Preview mode: submission is disabled.</p>
            )}
            <p className="arcw-note">
              <button type="button" className="arcw-link" onClick={reset}>Change details</button>
            </p>
          </>
        ) : (
          <Tracking intent={phase.intent} chainExplorer={(id) => chains.find((c) => c.id === id)?.explorerUrl} quote={quote} onReset={reset} />
        )}
      </>
    );
  }

  return (
    <div className="arcw" data-testid="arc-swap-widget">
      <style>{widgetCss}</style>
      <h2>Send to ARC</h2>
      {body}
    </div>
  );
}

function Tracking({
  intent,
  quote,
  chainExplorer,
  onReset,
}: {
  intent: Intent | null;
  quote: WidgetQuote;
  chainExplorer: (chainId: number) => string | undefined;
  onReset: () => void;
}) {
  const status = intent?.status ?? "PENDING";
  const failed = status === "FAILED" || status === "REFUNDED";
  const reached = STEPS.findIndex((s) => s.status === status);
  const done = TERMINAL_STATUSES.includes(status);
  const link = (chainId: number, hash: string | null) => {
    const base = chainExplorer(chainId);
    if (!hash) return null;
    return base && /^0x[0-9a-fA-F]{64}$/.test(hash) ? (
      <a className="arcw-mono" href={`${base.replace(/\/+$/, "")}/tx/${hash}`} target="_blank" rel="noreferrer">{hash}</a>
    ) : (
      <span className="arcw-mono">{hash}</span>
    );
  };

  return (
    <div aria-live="polite">
      <ol className="arcw-steps">
        {STEPS.map((s, i) => {
          const state = failed ? (i === 0 ? "done" : "pending") : i < reached || status === "EXECUTED_ON_ARC" ? "done" : i === reached ? "active" : "pending";
          return (
            <li key={s.status} data-state={state}>
              <span className="arcw-dot" />
              {s.label}
            </li>
          );
        })}
        {failed && (
          <li data-state="failed">
            <span className="arcw-dot" />
            {status === "REFUNDED" ? "Refunded" : "Failed"}
            {intent?.error ? `: ${intent.error}` : ""}
          </li>
        )}
      </ol>
      {intent?.originTx && <p className="arcw-note">Source tx: {link(quote.request.originChainId, intent.originTx)}</p>}
      {intent?.destTx && <p className="arcw-note">ARC tx: {link(quote.request.destChainId, intent.destTx)}</p>}
      {done && (
        <button type="button" className="arcw-btn" onClick={onReset}>
          {failed ? "Try again" : "Send another"}
        </button>
      )}
    </div>
  );
}

export { WidgetApiError };
