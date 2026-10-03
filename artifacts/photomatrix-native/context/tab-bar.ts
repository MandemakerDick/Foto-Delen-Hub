import { createContext, useContext } from 'react';

export const TabBarVisibilityContext = createContext<(hidden: boolean) => void>(() => undefined);

export function useTabBarVisibility() {
  return useContext(TabBarVisibilityContext);
}