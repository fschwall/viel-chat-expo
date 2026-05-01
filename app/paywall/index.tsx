import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';

import { triggerEntitlementRefresh } from '@/lib/entitlementRefresh';
import {
  getCurrentOffering,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from '@/lib/revenueCat';
import { getEntitlement, type ManageSubscriptionType } from '@/lib/workExperienceApi';

type PurchaseState = 'idle' | 'loading' | 'purchasing' | 'restoring';
const tierRank: Record<string, number> = {
  enterprise: 3,
  pro: 2,
  intermediate: 1,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const iosManageSubscriptionsUrl = 'https://apps.apple.com/account/subscriptions';
const androidManageSubscriptionsUrl =
  'https://play.google.com/store/account/subscriptions';

const inferPackageTier = (pkg: PurchasesPackage): 'intermediate' | 'pro' | null => {
  const haystack = [
    pkg.identifier,
    pkg.product.identifier,
    pkg.product.title,
    pkg.product.description,
  ]
    .join(' ')
    .toLowerCase();

  if (haystack.includes('intermediate')) {
    return 'intermediate';
  }
  if (haystack.includes('pro')) {
    return 'pro';
  }

  return null;
};

export default function NativePaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tier?: string }>();
  const requestedTier = typeof params.tier === 'string' ? params.tier : 'pro';
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isEligibleToPurchase, setIsEligibleToPurchase] = useState(true);
  const [manageSubscriptionType, setManageSubscriptionType] =
    useState<ManageSubscriptionType>('none');
  const [purchaseState, setPurchaseState] = useState<PurchaseState>('loading');

  const isLoading = purchaseState === 'loading';
  const isBusy = purchaseState === 'purchasing' || purchaseState === 'restoring';

  const waitForEntitlementSync = useCallback(async () => {
    const requestedRank = tierRank[requestedTier] ?? 1;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const entitlement = await getEntitlement();
      const currentRank = tierRank[entitlement.tier] ?? 0;

      if (entitlement.active && currentRank >= requestedRank) {
        return true;
      }

      await sleep(2500);
    }

    return false;
  }, [requestedTier]);

  const loadPaywall = useCallback(async () => {
    setPurchaseState('loading');
    setError(null);

    try {
      const entitlement = await getEntitlement();
      setIsEligibleToPurchase(entitlement.canPurchase);
      setManageSubscriptionType(entitlement.manageSubscriptionType);

      if (!entitlement.canPurchase) {
        setPackages([]);
        setPurchaseState('idle');
        return;
      }

      const currentOffering = await getCurrentOffering();
      setPackages(currentOffering?.availablePackages ?? []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load paywall.');
    } finally {
      setPurchaseState('idle');
    }
  }, []);

  useEffect(() => {
    void loadPaywall();
  }, [loadPaywall]);

  const handleManageSubscription = useCallback(async () => {
    const nextUrl =
      manageSubscriptionType === 'google'
        ? androidManageSubscriptionsUrl
        : manageSubscriptionType === 'apple'
          ? iosManageSubscriptionsUrl
          : Platform.OS === 'android'
            ? androidManageSubscriptionsUrl
            : iosManageSubscriptionsUrl;

    try {
      await Linking.openURL(nextUrl);
    } catch {
      setError('Unable to open subscription management.');
    }
  }, [manageSubscriptionType]);

  const handleSuccess = useCallback(async () => {
    await waitForEntitlementSync();
    triggerEntitlementRefresh();
    router.back();
  }, [router, waitForEntitlementSync]);

  const handlePurchase = useCallback(async (pkg: PurchasesPackage) => {
    setPurchaseState('purchasing');
    setError(null);

    try {
      await purchaseRevenueCatPackage(pkg);
      await handleSuccess();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Purchase failed.');
      setPurchaseState('idle');
    }
  }, [handleSuccess]);

  const handleRestore = useCallback(async () => {
    setPurchaseState('restoring');
    setError(null);

    try {
      await restoreRevenueCatPurchases();
      await handleSuccess();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Restore failed.');
      setPurchaseState('idle');
    }
  }, [handleSuccess]);

  const packageRows = useMemo(
    () =>
      packages.map((pkg) => {
        const packageId = pkg.identifier;
        const product = pkg.product;
        return {
          description: product.description,
          id: packageId,
          priceString: product.priceString,
          title: product.title,
          unit: product.subscriptionPeriod ?? '',
        };
      }),
    [packages],
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Upgrade to {requestedTier}</Text>
      <Text style={styles.subtitle}>
        Purchases in iOS and Android are handled with Apple/Google billing through RevenueCat.
      </Text>

      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading purchase options...</Text>
        </View>
      )}

      {!isLoading && !isEligibleToPurchase && (
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>You already have paid access</Text>
          <Text style={styles.calloutBody}>
            Purchase is disabled to prevent duplicate billing. Use your existing subscription
            management flow.
          </Text>
          <Pressable
            disabled={isBusy}
            onPress={handleManageSubscription}
            style={({ pressed }) => [
              styles.manageButton,
              (pressed || isBusy) && styles.buttonPressed,
            ]}
          >
            <Text style={styles.manageButtonText}>Manage subscription</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && isEligibleToPurchase && packageRows.length === 0 && (
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>No products available yet</Text>
          <Text style={styles.calloutBody}>
            RevenueCat has no current offering for this app environment.
          </Text>
        </View>
      )}

      {!isLoading && isEligibleToPurchase && packageRows.length > 0 && (
        <View style={styles.packages}>
          {packageRows.map((pkg, index) => (
            <Pressable
              key={pkg.id}
              disabled={isBusy}
              onPress={() => handlePurchase(packages[index]!)}
              style={({ pressed }) => {
                const inferredTier = inferPackageTier(packages[index]!);
                const isHighlighted = inferredTier === requestedTier;
                return [
                  styles.packageCard,
                  isHighlighted && styles.packageCardHighlighted,
                  (pressed || isBusy) && styles.packageCardPressed,
                ];
              }}
            >
              <Text style={styles.packageTitle}>{pkg.title}</Text>
              {inferPackageTier(packages[index]!) === requestedTier ? (
                <Text style={styles.highlightPill}>Recommended</Text>
              ) : null}
              <Text style={styles.packagePrice}>{pkg.priceString}</Text>
              <Text style={styles.packageDescription}>{pkg.description}</Text>
              {pkg.unit ? <Text style={styles.packageMeta}>{pkg.unit}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        disabled={isBusy}
        onPress={handleRestore}
        style={({ pressed }) => [styles.restoreButton, (pressed || isBusy) && styles.buttonPressed]}
      >
        {purchaseState === 'restoring' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.restoreText}>Restore purchases</Text>
        )}
      </Pressable>

      <Pressable
        disabled={isBusy}
        onPress={loadPaywall}
        style={({ pressed }) => [styles.secondaryButton, (pressed || isBusy) && styles.buttonPressed]}
      >
        <Text style={styles.secondaryText}>Refresh</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  buttonPressed: {
    opacity: 0.75,
  },
  callout: {
    backgroundColor: '#f4f4f4',
    borderRadius: 12,
    marginTop: 16,
    padding: 14,
  },
  calloutBody: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  calloutTitle: {
    color: '#111',
    fontSize: 16,
    fontWeight: '700',
  },
  container: {
    padding: 20,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
    marginTop: 16,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  loadingText: {
    color: '#444',
    fontSize: 14,
  },
  manageButton: {
    alignItems: 'center',
    borderColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  manageButtonText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '600',
  },
  highlightPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#0b66ff',
    borderRadius: 999,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  packageCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    marginTop: 12,
    padding: 14,
  },
  packageCardHighlighted: {
    borderColor: '#0b66ff',
    borderWidth: 2,
  },
  packageCardPressed: {
    opacity: 0.86,
  },
  packageDescription: {
    color: '#d2d2d2',
    fontSize: 13,
    marginTop: 8,
  },
  packageMeta: {
    color: '#9e9e9e',
    fontSize: 12,
    marginTop: 8,
  },
  packagePrice: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  packageTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  packages: {
    marginTop: 8,
  },
  restoreButton: {
    alignItems: 'center',
    backgroundColor: '#0b66ff',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  restoreText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#d0d5dd',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  secondaryText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    color: '#444',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  title: {
    color: '#111',
    fontSize: 28,
    fontWeight: '800',
  },
});
