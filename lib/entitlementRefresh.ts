type RefreshListener = () => void;

const listeners = new Set<RefreshListener>();

export function onEntitlementRefresh(listener: RefreshListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function triggerEntitlementRefresh() {
  for (const listener of listeners) {
    listener();
  }
}
