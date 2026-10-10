import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { createApi, WidgetApiError } from "./api.js";
import { widgetCss } from "./styles.js";
import {
  TERMINAL_STATUSES,
  type ArcSwapWidgetProps,
  type Chain,
  type Intent,
  type QuoteRequest,
  type Token,
  type WidgetQuote,
} from "./types.js";
import { formatUnits, parseUnits } from "./units.js";

const STEPS: { status: Intent["status"]; label: string }[] = [
  { status: "PENDING", label: "Submitted" },
  { status: "ORIGIN_CONFIRMED", label: "Confirmed on source chain" },
  { status: "FILLED", label: "Filled" },
  { status: "EXECUTED_ON_ARC", label: "Delivered on ARC" },
];

type Phase =
  | { name: "form" }
  | { name: "quoted"; quote: WidgetQuote; receivedAt: number }
  | { name: "tracking"; quote: WidgetQuote; intentId: string; intent: Intent | null };

const DEFAULT_ACCENT = "#1c1f3f";

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/** #rgb / #rrggbb, or the default. Anything else is ignored so hosts can't inject CSS. */
export function normalizeAccent(color: string | undefined): string {
  const c = (color ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(c)) return `#${[...c.slice(1)].map((h) => h + h).join("")}`.toLowerCase();
  return DEFAULT_ACCENT;
}

/** White or near-black text, whichever reads better on the accent. */
export function accentForeground(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#12142b" : "#ffffff";
}

const clampRadius = (r: number | undefined) => (r === undefined || Number.isNaN(r) ? 20 : Math.min(32, Math.max(0, r)));

const shortHash = (h: string) => (h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h);

/** "1 WETH ≈ 2,500.8 USDC" from the quote's own amounts. */
function rateText(q: WidgetQuote): string | null {
  try {
    const net = Number(BigInt(q.netAmount)) / 10 ** q.tokenIn.decimals;
    const out = Number(BigInt(q.estimatedOut)) / 10 ** q.tokenOut.decimals;
    if (!net || !out) return null;
    const rate = out / net;
    const digits = rate >= 1000 ? 2 : rate >= 1 ? 4 : 6;
    return `1 ${q.tokenIn.symbol} ≈ ${rate.toLocaleString("en-US", { maximumFractionDigits: digits })} ${q.tokenOut.symbol}`;
  } catch {
    return null;
  }
}

const Check = () => (
  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
const ArrowDown = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);
const Spinner = () => <span aria-hidden className="arcw-spin" />;

export function ArcSwapWidget(props: ArcSwapWidgetProps) {
  const {
    publishableKey,
    baseUrl = "http://localhost:3000",
    recipient: fixedRecipient,
    customerId,
    slippageBps = 50,
    pollIntervalMs = 3000,
    theme = "light",
    title = "Send to ARC",
  } = props;
  const api = useMemo(() => createApi(baseUrl, publishableKey), [baseUrl, publishableKey]);
  // Callbacks change identity every render in most apps; read them from a ref.
  const cb = useRef(props);
  cb.current = props;

  const accent = normalizeAccent(props.accentColor);
  const rootStyle = {
    "--arcw-accent": accent,
    "--arcw-accent-fg": accentForeground(accent),
    "--arcw-r": `${clampRadius(props.radius)}px`,
  } as CSSProperties;

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
  const [now, setNow] = useState(() => Date.now());

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

  // Tick once a second while a quote is on screen, for the expiry countdown.
  const showingQuote = phase.name === "quoted";
  useEffect(() => {
    if (!showingQuote) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showingQuote]);

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

  async function requestQuote(request: QuoteRequest, tIn: Token, tOut: Token) {
    setBusy(true);
    setError(null);
    try {
      const q = await api.quote(request);
      const quote: WidgetQuote = { ...q, request, tokenIn: tIn, tokenOut: tOut };
      setPhase({ name: "quoted", quote, receivedAt: Math.floor(Date.now() / 1000) });
      cb.current.onQuote?.(quote);
    } catch (err) {
      report(err);
    } finally {
      setBusy(false);
    }
  }

  async function getQuote(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const tIn = originTokens.find((t) => t.symbol === tokenIn);
    const tOut = destTokens.find((t) => t.symbol === tokenOut);
    if (originChainId === null || destChainId === null || !tIn || !tOut) return setError("Choose what to send and receive.");
    const amountIn = parseUnits(amount, tIn.decimals);
    if (!amountIn || amountIn === "0") return setError(`Enter an amount (up to ${tIn.decimals} decimals).`);
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient.trim())) return setError("Enter a valid receiving address (0x…).");
    await requestQuote(
      {
        originChainId,
        destChainId,
        tokenIn: tIn.symbol,
        tokenOut: tOut.symbol,
        amountIn,
        recipient: recipient.trim(),
        slippageBps,
        deadline: Math.floor(Date.now() / 1000) + 15 * 60,
        ...(customerId ? { customerId } : {}),
      },
      tIn,
      tOut
    );
  }

  /** Same request, fresh price and expiry. */
  function refreshQuote(quote: WidgetQuote) {
    void requestQuote({ ...quote.request, deadline: Math.floor(Date.now() / 1000) + 15 * 60 }, quote.tokenIn, quote.tokenOut);
  }

  async function confirm(quote: WidgetQuote) {
    const submit = cb.current.submitIntent;
    if (!submit) return;
    setError(null);
    if (Date.now() / 1000 > quote.expiresAt) return setError("That quote expired. Refresh it to continue.");
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
  const errorBox = error && (
    <p className="arcw-error" role="alert">
      {error}
    </p>
  );

  let body;
  if (loadError) {
    body = (
      <p className="arcw-error" role="alert">
        {loadError}
      </p>
    );
  } else if (!chains) {
    body = (
      <p className="arcw-note" style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        <Spinner /> Loading…
      </p>
    );
  } else if (phase.name === "form") {
    const sources = chains.filter((c) => !c.isArc);
    const destinations = chains.filter((c) => c.isArc);
    const tIn = originTokens.find((t) => t.symbol === tokenIn);
    body = (
      <form onSubmit={getQuote} noValidate>
        <div className="arcw-panel">
          <div className="arcw-panel-top">
            <span className="arcw-panel-title">You send</span>
            <span>
              <label htmlFor="arcw-origin" className="arcw-sr">
                From network
              </label>
              <select
                id="arcw-origin"
                className="arcw-select arcw-select-quiet"
                value={originChainId ?? ""}
                onChange={(e) => setOriginChainId(Number(e.target.value))}
              >
                {sources.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div className="arcw-amount-row">
            <input
              id="arcw-amount"
              className="arcw-amount"
              aria-label={`Amount${tIn ? ` (${tIn.symbol})` : ""}`}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            />
            <label htmlFor="arcw-token-in" className="arcw-sr">
              Send
            </label>
            <select id="arcw-token-in" className="arcw-select" value={tokenIn} onChange={(e) => setTokenIn(e.target.value)}>
              {originTokens.map((t) => (
                <option key={t.address} value={t.symbol}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="arcw-swap" aria-hidden>
          <span>
            <ArrowDown />
          </span>
        </div>

        <div className="arcw-panel">
          <div className="arcw-panel-top">
            <span className="arcw-panel-title">You receive</span>
            <span>
              <label htmlFor="arcw-dest" className="arcw-sr">
                To network
              </label>
              <select
                id="arcw-dest"
                className="arcw-select arcw-select-quiet"
                value={destChainId ?? ""}
                onChange={(e) => setDestChainId(Number(e.target.value))}
              >
                {destinations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div className="arcw-amount-row">
            <span className="arcw-estimate" title="Get a quote to see the exact amount">
              —
            </span>
            <label htmlFor="arcw-token-out" className="arcw-sr">
              Receive
            </label>
            <select id="arcw-token-out" className="arcw-select" value={tokenOut} onChange={(e) => setTokenOut(e.target.value)}>
              {destTokens.map((t) => (
                <option key={t.address} value={t.symbol}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="arcw-field">
          <label htmlFor="arcw-recipient">Receiving address</label>
          <input
            id="arcw-recipient"
            className="arcw-input arcw-mono"
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            readOnly={fixedRecipient !== undefined}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>
        {errorBox}
        <button type="submit" className="arcw-btn" disabled={busy}>
          {busy ? (
            <>
              <Spinner /> Getting quote…
            </>
          ) : (
            "Get quote"
          )}
        </button>
      </form>
    );
  } else {
    const { quote } = phase;
    const { tokenIn: tIn, tokenOut: tOut } = quote;
    const secondsLeft = Math.max(0, Math.floor(quote.expiresAt - now / 1000));
    const expired = phase.name === "quoted" && secondsLeft === 0;
    const total = phase.name === "quoted" ? Math.max(1, quote.expiresAt - phase.receivedAt) : 1;
    const rate = rateText(quote);
    body = (
      <>
        <div className="arcw-hero">
          <small>You receive (est.)</small>
          <strong>
            {formatUnits(quote.estimatedOut, tOut.decimals)} {tOut.symbol}
          </strong>
          <span className="arcw-route">
            {chainName(quote.request.originChainId)} → {chainName(quote.request.destChainId)}
          </span>
        </div>
        <dl className="arcw-rows">
          <dt>You send</dt>
          <dd>
            {formatUnits(quote.amountIn, tIn.decimals)} {tIn.symbol} on {chainName(quote.request.originChainId)}
          </dd>
          <dt>Fee ({(quote.feeBps / 100).toFixed(2)}%)</dt>
          <dd>
            {formatUnits(quote.feeAmount, tIn.decimals)} {tIn.symbol}
          </dd>
          <dt>You receive (est.)</dt>
          <dd>
            {formatUnits(quote.estimatedOut, tOut.decimals)} {tOut.symbol} on {chainName(quote.request.destChainId)}
          </dd>
          <dt>Minimum</dt>
          <dd>
            {formatUnits(quote.minOut, tOut.decimals)} {tOut.symbol}
          </dd>
          {rate && (
            <>
              <dt>Rate</dt>
              <dd>{rate}</dd>
            </>
          )}
          <dt>To</dt>
          <dd className="arcw-mono" title={quote.request.recipient}>
            {shortHash(quote.request.recipient)}
          </dd>
        </dl>
        {phase.name === "quoted" ? (
          <>
            {expired ? (
              <p className="arcw-timer">Quote expired</p>
            ) : (
              <div className="arcw-timer" aria-label={`Quote valid for ${secondsLeft} seconds`}>
                <span>
                  Valid {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                </span>
                <span className="arcw-timer-bar" aria-hidden>
                  <i style={{ width: `${Math.min(100, (secondsLeft / total) * 100)}%` }} />
                </span>
              </div>
            )}
            {errorBox}
            {expired ? (
              <button type="button" className="arcw-btn" disabled={busy} onClick={() => refreshQuote(quote)}>
                {busy ? <Spinner /> : null} Refresh quote
              </button>
            ) : props.submitIntent ? (
              <button type="button" className="arcw-btn" disabled={busy} onClick={() => confirm(quote)}>
                {busy ? (
                  <>
                    <Spinner /> Submitting…
                  </>
                ) : (
                  "Confirm"
                )}
              </button>
            ) : (
              <p className="arcw-note" role="note">
                Preview mode: submission is disabled.
              </p>
            )}
            <p className="arcw-note">
              <button type="button" className="arcw-link" onClick={reset}>
                Change details
              </button>
            </p>
          </>
        ) : (
          <Tracking
            intent={phase.intent}
            chainExplorer={(id) => chains.find((c) => c.id === id)?.explorerUrl}
            quote={quote}
            onReset={reset}
          />
        )}
      </>
    );
  }

  return (
    <div className="arcw" data-theme={theme} style={rootStyle} data-testid="arc-swap-widget">
      <style>{widgetCss}</style>
      <div className="arcw-head">
        <h2>{title}</h2>
        <span className="arcw-chip">Max slippage {(slippageBps / 100).toFixed(slippageBps % 100 ? 2 : 1)}%</span>
      </div>
      {body}
      <p className="arcw-foot">
        Secured by <b>Stableflowr</b>
      </p>
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
  const progress = failed ? 100 : status === "EXECUTED_ON_ARC" ? 100 : ((reached + 0.5) / STEPS.length) * 100;
  const link = (chainId: number, hash: string | null) => {
    const base = chainExplorer(chainId);
    if (!hash) return null;
    return base && /^0x[0-9a-fA-F]{64}$/.test(hash) ? (
      <a className="arcw-mono" href={`${base.replace(/\/+$/, "")}/tx/${hash}`} target="_blank" rel="noreferrer" title={hash}>
        {shortHash(hash)} ↗
      </a>
    ) : (
      <span className="arcw-mono">{shortHash(hash)}</span>
    );
  };

  return (
    <div aria-live="polite" style={{ marginTop: 14 }}>
      <div className="arcw-progress" data-failed={failed ? "" : undefined} aria-hidden>
        <i style={{ width: `${progress}%` }} />
      </div>
      <ol className="arcw-steps">
        {STEPS.map((s, i) => {
          const state = failed
            ? i === 0
              ? "done"
              : "pending"
            : i < reached || status === "EXECUTED_ON_ARC"
              ? "done"
              : i === reached
                ? "active"
                : "pending";
          return (
            <li key={s.status} data-state={state}>
              <span className="arcw-dot">{state === "done" ? <Check /> : state === "active" ? <Spinner /> : null}</span>
              {s.label}
            </li>
          );
        })}
        {failed && (
          <li data-state="failed">
            <span className="arcw-dot">!</span>
            {status === "REFUNDED" ? "Refunded" : "Failed"}
            {intent?.error ? `: ${intent.error}` : ""}
          </li>
        )}
      </ol>
      {(intent?.originTx || intent?.destTx) && (
        <div className="arcw-txs">
          {intent?.originTx && (
            <div>
              <span>Source tx</span>
              {link(quote.request.originChainId, intent.originTx)}
            </div>
          )}
          {intent?.destTx && (
            <div>
              <span>ARC tx</span>
              {link(quote.request.destChainId, intent.destTx)}
            </div>
          )}
        </div>
      )}
      {status === "EXECUTED_ON_ARC" && (
        <div className="arcw-done">
          <Check /> Delivered to {shortHash(quote.request.recipient)} on ARC
        </div>
      )}
      {done && (
        <button type="button" className="arcw-btn" onClick={onReset}>
          {failed ? "Try again" : "Send another"}
        </button>
      )}
    </div>
  );
}

export { WidgetApiError };
