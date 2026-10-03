import { createContext, useContext, useEffect, useRef } from 'react';

export type TabName = 'index' | 'gallery' | 'my-photos' | 'liked-photos';
export type TabResets = Record<TabName, number>;

export const TabResetContext = createContext<TabResets | null>(null);

export function useTabPressReset(tab: TabName, scrollToTop: () => void) {
  const resets = useContext(TabResetContext);
  const scroll = useRef(scrollToTop);
  scroll.current = scrollToTop;

  // The legacy /gallery and /my-photos links also render these screens outside tabs.
  const reset = resets?.[tab] ?? 0;
  useEffect(() => {
    if (reset === 0) return;
    const frame = requestAnimationFrame(() => scroll.current());
    return () => cancelAnimationFrame(frame);
  }, [reset]);
}