import { useState, type FormEvent } from "react";
import type { WebhookEndpoint } from "stableflowr-sdk";
import { CopyButton } from "../CopyButton";
import { describeError } from "../../lib/gateway";
import { formatDate } from "../../lib/format";
import { useCreateWebhook, useDeleteWebhook, useTestWebhook, useWebhookEvents, useWebhooks } from "../../lib/queries";
import { buttonClass, Card, Empty, inputClass, Loading, secondaryButtonClass } from "./ui";

const statusTone = {
  succeeded: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-800",
  failed: "bg-red-50 text-red-700",
} as const;

function Endpoint({ hook }: { hook: WebhookEndpoint }) {
  const [reveal, setReveal] = useState(false);
  const [open, setOpen] = useState(false);
  const test = useTestWebhook();
  const remove = useDeleteWebhook();
  const events = useWebhookEvents(open ? hook.id : null);
  return (
    <li className="rounded-2xl border border-mist-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <code className="min-w-0 break-all font-mono text-sm text-ink-900">{hook.url}</code>
        <div className="flex gap-2">
          <button type="button" className={`${secondaryButtonClass} px-3 py-1.5 text-xs`} disabled={test.isPending} onClick={() => test.mutate(hook.id)}>
            {test.isPending ? "Sending…" : "Send test"}
          </button>
          <button
            type="button"
            className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            onClick={() => remove.mutate(hook.id)}
          >
            Remove
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-600">
        Signing secret
        <code className="rounded-full bg-mist-100 px-2.5 py-1 font-mono text-ink-800">{reveal ? hook.secret : "whsec_••••••••"}</code>
        <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => setReveal((r) => !r)}>
          {reveal ? "Hide" : "Reveal"}
        </button>
        <CopyButton text={hook.secret} label="Copy" />
      </div>
      {test.data && (
        <p role="status" className={`mt-3 text-xs ${test.data.status === "succeeded" ? "text-green-700" : "text-red-600"}`}>
          Test {test.data.status === "succeeded" ? `delivered (HTTP ${test.data.lastStatusCode})` : `failed: ${test.data.lastError}`}
        </p>
      )}
      <button type="button" className="mt-3 text-xs font-medium text-ink-600 hover:text-ink-900" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide deliveries" : "Recent deliveries"}
      </button>
      {open &&
        (events.isPending ? (
          <Loading />
        ) : events.data?.items.length ? (
          <ul className="mt-2 divide-y divide-mist-100 text-xs">
            {events.data.items.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-mono text-ink-900">{e.type}</span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${statusTone[e.status]}`}>
                  {e.status}
                  {e.lastStatusCode ? ` · ${e.lastStatusCode}` : ""}
                </span>
                <span className="text-ink-600">
                  {e.attempts} attempt{e.attempts === 1 ? "" : "s"} · {formatDate(e.createdAt)}
                  {e.lastError && e.status !== "succeeded" ? ` · ${e.lastError}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-ink-600">No deliveries yet.</p>
        ))}
    </li>
  );
}

/** Where payment events are sent, signed with each endpoint's secret. */
export function WebhooksCard() {
  const hooks = useWebhooks();
  const create = useCreateWebhook();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync(url.trim());
      setUrl("");
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Card title="Webhooks">
      <p className="text-sm text-ink-600">
        Get a signed POST when a payment is processing, paid, partly paid or expired, so your server can fulfil orders
        without polling. Verify each request with <span className="font-mono">verifyWebhook()</span> from the SDK.
      </p>
      <form onSubmit={onSubmit} className="mt-5 flex flex-wrap gap-2">
        <span className="min-w-0 flex-1">
          <label htmlFor="webhook-url" className="sr-only">
            Endpoint URL
          </label>
          <input
            id="webhook-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourapp.com/hooks/arc"
            className={`font-mono ${inputClass}`}
          />
        </span>
        <button type="submit" className={buttonClass} disabled={!url.trim() || create.isPending}>
          {create.isPending ? "Adding…" : "Add endpoint"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-5">
        {hooks.isPending ? (
          <Loading />
        ) : hooks.data?.items.length ? (
          <ul className="space-y-3">
            {hooks.data.items.map((h) => (
              <Endpoint key={h.id} hook={h} />
            ))}
          </ul>
        ) : (
          <Empty>No endpoints yet.</Empty>
        )}
      </div>
    </Card>
  );
}
