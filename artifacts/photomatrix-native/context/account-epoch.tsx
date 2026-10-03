import { createContext, useCallback, useContext } from 'react';
import type { AccountEpoch } from '@/utils/accountEpoch';

export const AccountEpochContext = createContext<{ session: AccountEpoch; epoch: number } | null>(null);

// Capture ownership of this render, not just the latest account ID.
export function useAccountGuard() {
  const context = useContext(AccountEpochContext);
  if (!context) throw new Error('Account epoch provider is missing');
  const { session, epoch } = context;
  return useCallback(() => session.isCurrent(epoch), [session, epoch]);
}