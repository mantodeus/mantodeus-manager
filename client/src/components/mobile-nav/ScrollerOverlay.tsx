/**
 * Scroller Overlay Component
 *
 * Backdrop overlay that dims the app background when scroller is active.
 * § 9.3: Background - App background dims subtly, feels paused not blocked
 */

import { cn } from '@/lib/utils';
import { useMobileNav } from './MobileNavProvider';

export function ScrollerOverlay() {
  const { scrollerVisible } = useMobileNav();

  if (!scrollerVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-[999]',
        'bg-background/10', // § 9.3: Subtle dim (10-12%)
        'animate-overlay-fade-in',
        'md:hidden' // § 1.1: Mobile only
      )}
      aria-hidden="true"
    />
  );
}
