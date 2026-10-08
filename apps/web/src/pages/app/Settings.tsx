import { Card, ErrorState, Loading, PageTitle } from "../../components/dashboard/ui";
import { formatBps, formatDate } from "../../lib/format";
import { usePartnerProfile } from "../../lib/queries";

export function Settings() {
  const profile = usePartnerProfile();

  return (
    <>
      <PageTitle title="Settings" />
      {profile.isPending ? (
        <Loading />
      ) : profile.error ? (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      ) : (
        <div className="grid max-w-3xl gap-6">
          <Card title="Business">
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
              <dt className="text-slate-500">Name</dt>
              <dd>{profile.data.name}</dd>
              <dt className="text-slate-500">Contact email</dt>
              <dd>{profile.data.email ?? <span className="text-slate-400">Not set</span>}</dd>
              <dt className="text-slate-500">Partner ID</dt>
              <dd className="break-all font-mono text-xs">{profile.data.partnerId}</dd>
              <dt className="text-slate-500">Member since</dt>
              <dd>{formatDate(profile.data.createdAt)}</dd>
            </dl>
          </Card>

          <Card title="Plan">
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
              <dt className="text-slate-500">Transaction fee</dt>
              <dd>
                {formatBps(profile.data.feeBps)} ({profile.data.feeBps} bps)
              </dd>
              <dt className="text-slate-500">Rate limit</dt>
              <dd>{profile.data.rateLimitPerMin} requests/min per key</dd>
            </dl>
          </Card>

          <Card title="API key">
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
              <dt className="text-slate-500">Secret key</dt>
              <dd className="font-mono">{profile.data.apiKey.keyPrefix}••••••••</dd>
              <dt className="text-slate-500">Created</dt>
              <dd>{formatDate(profile.data.apiKey.createdAt)}</dd>
            </dl>
            <p className="mt-4 text-sm text-slate-500">
              We store only a hash of your key, so it can't be shown again. If it leaks, rotate it.
            </p>
          </Card>

          <Card title="Customer payouts">
            <p className="text-sm text-slate-600">
              Fees are tracked per customer in your ledger. Payouts to customer wallets aren't live yet; customers will
              be able to set a payout wallet ahead of time.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
