import { PagePlaceholder } from "../../components/PagePlaceholder";
import { usePartnerProfile } from "../../lib/queries";

export function Overview() {
  const profile = usePartnerProfile();
  return (
    <PagePlaceholder title="Overview">
      {profile.data
        ? `Fee ${(profile.data.feeBps / 100).toFixed(2)}% · ${profile.data.rateLimitPerMin} requests/min`
        : "Loading…"}
    </PagePlaceholder>
  );
}
