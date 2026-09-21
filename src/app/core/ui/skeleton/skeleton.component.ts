import { Component, computed, input } from '@angular/core';

/** Figma: Skeleton variants (119:331) — Line 240×12, Card 240×96, Chart 240×200. */
export type SkeletonVariant = 'line' | 'card' | 'chart';

const VARIANT_HEIGHT: Record<SkeletonVariant, string> = {
  line: '12px',
  card: '96px',
  chart: '200px',
};

const VARIANT_RADIUS: Record<SkeletonVariant, string> = {
  line: 'var(--radius-full)',
  card: 'var(--radius-lg)',
  chart: 'var(--radius-md)',
};

/**
 * Figma: Data / Skeleton (119:331).
 *
 * Hidden from assistive technology: the container that swaps content for
 * skeletons is the one that owns `aria-busy`, so announcing the placeholder
 * itself would only add noise.
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    <span
      class="bg-surface-subtle block w-full animate-pulse"
      aria-hidden="true"
      [style.height]="height()"
      [style.width]="width()"
      [style.border-radius]="radius()"></span>
  `,
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('line');
  /** Narrows the placeholder, e.g. `60%` for a short line. */
  readonly width = input('100%');

  protected readonly height = computed(() => VARIANT_HEIGHT[this.variant()]);
  protected readonly radius = computed(() => VARIANT_RADIUS[this.variant()]);
}
