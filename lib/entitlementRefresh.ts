export type EntitlementRefreshReason =
  | 'purchase_completed'
  | 'restore_completed'
  | 'manual';

export type EntitlementRefreshEvent = {
  reason: EntitlementRefreshReason;
};

type RefreshListener = (event: EntitlementRefreshEvent) => void;

const listeners = new Set<RefreshListener>();

export function onEntitlementRefresh(listener: RefreshListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function triggerEntitlementRefresh(
  event: EntitlementRefreshEvent = { reason: 'manual' },
) {
  for (const listener of listeners) {
    listener(event);
  }
}
