import { workExperienceApiUrl } from '@/lib/expoConfig';
import { getSupabaseAccessToken } from '@/lib/supabase';

export type BillingTier = 'free' | 'intermediate' | 'pro' | 'enterprise';
export type PaidEntitlement = 'intermediate' | 'pro' | 'enterprise';
export type BillingProvider = 'none' | 'stripe' | 'revenuecat';
export type BillingPlatform = 'none' | 'web' | 'ios' | 'android';
export type ManageSubscriptionType = 'none' | 'stripe' | 'apple' | 'google';

export type EntitlementResponse = {
  active: boolean;
  canPurchase: boolean;
  entitlement: 'none' | PaidEntitlement;
  expiresAt: string | null;
  manageSubscriptionType: ManageSubscriptionType;
  platform: BillingPlatform;
  provider: BillingProvider;
  tier: BillingTier;
};

type TrpcEnvelope<T> = {
  error?: {
    json?: {
      message?: string;
    };
    message?: string;
  };
  result?: {
    data?: {
      json?: T;
    } | T;
  };
};

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

function readTrpcData<T>(payload: TrpcEnvelope<T>): T {
  if (payload.error) {
    throw new Error(
      payload.error.json?.message ?? payload.error.message ?? 'tRPC request failed',
    );
  }

  const data = payload.result?.data;
  if (data && typeof data === 'object' && 'json' in data) {
    return data.json as T;
  }

  if (data) {
    return data as T;
  }

  throw new Error('tRPC response did not include result data');
}

export async function callWorkExperienceTrpc<T>(
  path: string,
  input: unknown = null,
  accessToken?: string | null,
  method: 'GET' | 'POST' = 'POST',
): Promise<T> {
  const token = accessToken ?? (await getSupabaseAccessToken());

  if (!token) {
    throw new Error('No Supabase access token is available');
  }

  const url = new URL(`${trimTrailingSlash(workExperienceApiUrl)}/api/trpc/${path}`);
  const requestInit: RequestInit = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method,
  };

  if (method === 'GET') {
    if (input !== null && input !== undefined) {
      url.searchParams.set('input', JSON.stringify({ json: input }));
    }
  } else {
    requestInit.body = JSON.stringify({ json: input });
  }

  const response = await fetch(url.toString(), requestInit);

  const payload = (await response.json()) as TrpcEnvelope<T>;

  if (!response.ok) {
    throw new Error(
      payload.error?.json?.message ??
        payload.error?.message ??
        `WorkExperience API request failed with ${response.status}`,
    );
  }

  return readTrpcData(payload);
}

export function getEntitlement(accessToken?: string | null) {
  return callWorkExperienceTrpc<EntitlementResponse>(
    'profile.getEntitlement',
    null,
    accessToken,
    'GET',
  );
}
