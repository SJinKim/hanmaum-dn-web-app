import { Injectable, PLATFORM_ID, Signal, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Figma: Density modes Desktop 1440 / Tablet 834 / Phone 390 (26:7).
 *
 * The density scale in styles.scss §3 already re-points every `size/*` and
 * `space/*` token per viewport through the same two media queries. This service
 * exposes the identical thresholds to TypeScript for the decisions CSS cannot
 * make: which Sidebar mode renders, and whether the Topbar shows the Drawer
 * button. The queries are kept byte-identical to styles.scss — one number in two
 * places is the only duplication, and a mismatch would show up as a sidebar
 * whose width and mode disagree.
 */
export type Breakpoint = 'desktop' | 'tablet' | 'phone';

const PHONE_QUERY = '(max-width: 833px)';
const TABLET_QUERY = '(max-width: 1439px)';

@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly phone = this.watch(PHONE_QUERY);
  private readonly belowDesktop = this.watch(TABLET_QUERY);

  /** Server-side and in tests without matchMedia the desktop layout renders. */
  readonly current: Signal<Breakpoint> = computed(() => {
    if (this.phone()) { return 'phone'; }
    return this.belowDesktop() ? 'tablet' : 'desktop';
  });

  readonly isPhone = computed(() => this.current() === 'phone');
  readonly isTablet = computed(() => this.current() === 'tablet');
  readonly isDesktop = computed(() => this.current() === 'desktop');

  private watch(query: string): Signal<boolean> {
    if (!isPlatformBrowser(this.platformId) || typeof window.matchMedia !== 'function') {
      return signal(false).asReadonly();
    }
    const list = window.matchMedia(query);
    const matches = signal(list.matches);
    list.addEventListener('change', event => matches.set(event.matches));
    return matches.asReadonly();
  }
}
