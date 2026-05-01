import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import { revenueCatApiKey } from '@/lib/expoConfig';

let isConfigured = false;
let configurationErrorMessage: string | null = null;

export function canUseRevenueCat() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function getRevenueCatConfigurationError() {
  return configurationErrorMessage;
}

export async function ensureRevenueCatConfigured(appUserId?: string | null) {
  if (!canUseRevenueCat()) {
    return false;
  }

  if (!revenueCatApiKey) {
    throw new Error('RevenueCat API key is not configured for this platform.');
  }

  if (!isConfigured) {
    // Expo Go does not support native store billing. We keep the app running and surface
    // a clear runtime error when paywall actions are attempted.
    if (Constants.appOwnership === 'expo') {
      configurationErrorMessage =
        'RevenueCat native store is unavailable in Expo Go. Use a development build or a RevenueCat Test Store key.';
      return false;
    }

    try {
      await Purchases.configure({
        apiKey: revenueCatApiKey,
        appUserID: appUserId ?? undefined,
      });
      isConfigured = true;
      configurationErrorMessage = null;
      return true;
    } catch (error) {
      configurationErrorMessage =
        error instanceof Error ? error.message : 'Failed to configure RevenueCat.';
      return false;
    }
  }

  if (appUserId) {
    await Purchases.logIn(appUserId);
  }

  return true;
}

export async function syncRevenueCatUser(appUserId: string | null) {
  const configured = await ensureRevenueCatConfigured(appUserId);
  if (!configured) {
    return;
  }

  if (!appUserId) {
    const customerInfo = await Purchases.getCustomerInfo();

    // Avoid noisy warnings from RevenueCat when logOut is called while already anonymous.
    if (!customerInfo.originalAppUserId.startsWith('$RCAnonymousID:')) {
      await Purchases.logOut();
    }
  }
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const configured = await ensureRevenueCatConfigured();
  if (!configured) {
    throw new Error(
      getRevenueCatConfigurationError() ??
        'RevenueCat is not configured for this runtime.',
    );
  }
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export async function purchaseRevenueCatPackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo> {
  const configured = await ensureRevenueCatConfigured();
  if (!configured) {
    throw new Error(
      getRevenueCatConfigurationError() ??
        'RevenueCat is not configured for this runtime.',
    );
  }
  const purchaseResult = await Purchases.purchasePackage(pkg);
  return purchaseResult.customerInfo;
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
  const configured = await ensureRevenueCatConfigured();
  if (!configured) {
    throw new Error(
      getRevenueCatConfigurationError() ??
        'RevenueCat is not configured for this runtime.',
    );
  }
  return Purchases.restorePurchases();
}
