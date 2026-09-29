import { useSyncExternalStore } from 'react';
import { getCollection, subscribeCollection } from '@/lib/collection';

/** Live "My collection" store: each sign's level and next review time. */
export function useCollection() {
  return useSyncExternalStore(subscribeCollection, getCollection, getCollection);
}
