import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ApiKeySummary } from "@arc/gateway-sdk";
import { CopyButton } from "../CopyButton";
import { useGateway } from "../../lib/auth";
import { describeError } from "../../lib/gateway";
import { formatDate } from "../../lib/format";
import { useApiKeys, useCreatePublishableKey, useRevokeApiKey } from "../../lib/queries";
import { buttonClass, Card, Empty, ErrorState, inputClass, Loading, secondaryButtonClass } from "./ui";

const masked = (k: ApiKeySummary) => `${k.keyPrefix}••••${k.last4 ?? "••••"}`;

export function SecretKeyCard() {
  const keys = useApiKeys();
  const current = keys.data?.items.find((k) => k.current);
  const history = keys.data?.items.filter((k) => k.kind === "secret" && !k.current) ?? [];

  return (
    <Card title="Secret key">
      {keys.isPending ? (
        <Loading />
      ) : keys.error ? (
        <ErrorState error={keys.error} onRetry={() => void keys.refetch()} />
      ) : (
        <>
          {current && (
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
              <dt className="text-slate-500">Key</dt>
              <dd className="font-mono">{masked(current)}</dd>
              <dt className="text-slate-500">Created</dt>
              <dd>{formatDate(current.createdAt)}</dd>
            </dl>
          )}
          {history.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-slate-600">Previous keys ({history.length})</summary>
              <ul className="mt-2 space-y-1 text-slate-500">
                {history.map((k) => (
                  <li key={k.id}>
                    <span className="font-mono">{masked(k)}</span> · created {formatDate(k.createdAt)}
                    {k.revokedAt && ` · revoked ${formatDate(k.revokedAt)}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      <p className="mt-4 text-sm text-slate-500">
        Use it only on your server. We store a hash, so it can't be shown again. If it leaks, rotate it.
      </p>
      {/* Outside the loading branch so the one-time reveal survives the key switch. */}
      <RotateKey />
    </Card>
  );
}

function RotateKey() {
  const { client, scope } = useGateway();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<"idle" | "confirm" | "working">("idle");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rotate() {
    setStage("working");
    setError(null);
    try {
      const { apiKey } = await client.rotateApiKey();
      // The gateway moved this session onto the new key; show the key once
      // and refresh what depends on which key is current.
      setNewKey(apiKey);
      void queryClient.invalidateQueries({ queryKey: ["me", scope] });
      void queryClient.invalidateQueries({ queryKey: ["api-keys", scope] });
      setStage("idle");
    } catch (err) {
      setError(describeError(err));
      setStage("confirm");
    }
  }

  if (newKey) {
    return (
      <div role="note" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Your new secret key. Store it now; it is shown only once.</p>
        <p className="mt-1">The old key stopped working. Update your servers with this one.</p>
        <code data-testid="new-api-key" className="mt-3 block break-all rounded bg-white p-3 font-mono text-slate-900">
          {newKey}
        </code>
        <div className="mt-3 flex gap-2">
          <CopyButton text={newKey} label="Copy key" />
          <button type="button" className={secondaryButtonClass} onClick={() => setNewKey(null)}>
            I've stored it
          </button>
        </div>
      </div>
    );
  }

  if (stage === "idle") {
    return (
      <button type="button" className={`mt-4 ${secondaryButtonClass}`} onClick={() => setStage("confirm")}>
        Rotate secret key
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
      <p className="font-medium text-red-800">Rotate your secret key?</p>
      <p className="mt-1 text-red-700">
        The current key stops working immediately. Anything still using it (your servers, scripts) will get 401 until
        you update it. Your history and customers are kept.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          disabled={stage === "working"}
          onClick={rotate}
        >
          {stage === "working" ? "Rotating…" : "Rotate now"}
        </button>
        <button type="button" className={secondaryButtonClass} disabled={stage === "working"} onClick={() => setStage("idle")}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PublishableKeysCard() {
  const keys = useApiKeys();
  const publishable = keys.data?.items.filter((k) => k.kind === "publishable") ?? [];
  const active = publishable.filter((k) => k.active);
  const revoked = publishable.filter((k) => !k.active);

  return (
    <Card title="Publishable keys">
      <p className="text-sm text-slate-500">
        For the swap widget in your customers' browsers. A publishable key can only request quotes and read intent
        status, and only from the websites you list. It can't submit intents or read your data.
      </p>
      <div className="mt-4">
        {keys.isPending ? (
          <Loading />
        ) : keys.error ? (
          <ErrorState error={keys.error} />
        ) : active.length === 0 ? (
          <Empty>No publishable keys yet.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((k) => (
              <PublishableKeyRow key={k.id} apiKey={k} />
            ))}
          </ul>
        )}
      </div>
      <CreatePublishableKey />
      {revoked.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-slate-600">Revoked ({revoked.length})</summary>
          <ul className="mt-2 space-y-1 text-slate-500">
            {revoked.map((k) => (
              <li key={k.id}>
                <span className="font-mono">{masked(k)}</span>
                {k.revokedAt && ` · revoked ${formatDate(k.revokedAt)}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function PublishableKeyRow({ apiKey }: { apiKey: ApiKeySummary }) {
  const revoke = useRevokeApiKey();
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="break-all font-mono text-xs">{apiKey.publishableKey}</code>
        <div className="flex gap-2">
          {apiKey.publishableKey && <CopyButton text={apiKey.publishableKey} />}
          {confirming ? (
            <>
              <button
                type="button"
                className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(apiKey.id)}
              >
                {revoke.isPending ? "Revoking…" : "Confirm revoke"}
              </button>
              <button type="button" className="text-xs text-slate-600" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50"
              onClick={() => setConfirming(true)}
            >
              Revoke
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Allowed sites: {(apiKey.allowedOrigins ?? []).join(", ") || "none"} · created {formatDate(apiKey.createdAt)}
      </p>
      {revoke.error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {describeError(revoke.error)}
        </p>
      )}
    </li>
  );
}

function CreatePublishableKey() {
  const create = useCreatePublishableKey();
  const [origins, setOrigins] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const list = origins
      .split(/[\s,]+/)
      .map((o) => o.trim().replace(/\/+$/, ""))
      .filter(Boolean);
    if (list.length === 0) return setError("Add at least one website, e.g. https://shop.example.com");
    try {
      await create.mutateAsync(list);
      setOrigins("");
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 border-t border-slate-200 pt-4">
      <label htmlFor="allowed-origins" className="block text-sm font-medium text-slate-700">
        Allowed websites
      </label>
      <textarea
        id="allowed-origins"
        rows={2}
        value={origins}
        onChange={(e) => setOrigins(e.target.value)}
        placeholder={"https://shop.example.com\nhttp://localhost:5173"}
        className={`mt-1 font-mono ${inputClass}`}
      />
      <p className="mt-1 text-xs text-slate-500">
        One per line: scheme and host, no path. To preview the widget here, include {window.location.origin}.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" className={`mt-3 ${buttonClass}`} disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create publishable key"}
      </button>
    </form>
  );
}
