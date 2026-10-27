import { http } from "../../../shared/api/http";
import type { BillingStatus } from "../model/billing";

function authConfig(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

export async function getBillingStatus(accessToken: string): Promise<BillingStatus> {
  const response = await http.get<BillingStatus>(
    "/billing/subscription",
    authConfig(accessToken),
  );
  return response.data;
}

export async function createCheckoutSession(accessToken: string): Promise<string> {
  const response = await http.post<{ url: string }>(
    "/billing/checkout",
    {},
    authConfig(accessToken),
  );
  return response.data.url;
}

export async function createPortalSession(accessToken: string): Promise<string> {
  const response = await http.post<{ url: string }>(
    "/billing/portal",
    {},
    authConfig(accessToken),
  );
  return response.data.url;
}
