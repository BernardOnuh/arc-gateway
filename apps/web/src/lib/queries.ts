import { useQuery } from "@tanstack/react-query";
import { useGateway } from "./auth";

export function usePartnerProfile() {
  const { client, apiKey } = useGateway();
  return useQuery({ queryKey: ["me", apiKey], queryFn: () => client.me() });
}
