import { useParams, useSearchParams } from "react-router-dom";
import { ArcCheckout } from "@arc/widget";
import { SkyBackdrop } from "../components/art";
import { ThemeToggle } from "../components/ThemeToggle";
import { GATEWAY_URL } from "../lib/env";

/**
 * Hosted checkout: /checkout/:paymentId?key=pk_live_…
 * The publishable key is public by design; it must allow this site's origin.
 */
export function Checkout() {
  const { paymentId } = useParams();
  const [params] = useSearchParams();
  const key = params.get("key");

  return (
    <div className="relative flex min-h-screen flex-col items-center px-4 py-16">
      <SkyBackdrop />
      <div className="absolute right-4 top-4">
        <ThemeToggle onSky />
      </div>
      <div className="relative w-full max-w-[420px]">
        {key && paymentId ? (
          // The merchant's saved branding (theme included) comes with the payment.
          <ArcCheckout publishableKey={key} baseUrl={GATEWAY_URL} paymentId={paymentId} />
        ) : (
          <div className="glass rounded-4xl bg-white/80 p-8 text-center text-ink-700">
            This checkout link is incomplete. Ask the merchant for a new one.
          </div>
        )}
      </div>
    </div>
  );
}
