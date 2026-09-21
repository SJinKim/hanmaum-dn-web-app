import { Component, computed, input } from '@angular/core';

/** Figma: ProgressBar Size axis (104:59) — Small 240×24, Medium 240×26. */
export type ProgressBarSize = 'small' | 'medium';

const TRACK_HEIGHT: Record<ProgressBarSize, string> = {
  small: '6px',
  medium: '8px',
};

/**
 * Figma: Data / ProgressBar (104:59).
 *
 * "Always color/action/primary fill — never red/amber/green." Progress is not a
 * status, so it never borrows the badge palette; the value text next to the
 * track is what conveys where the record stands.
 */
@Component({
  selector: 'app-progress-bar',
  standalone: true,
  template: `
    <div class="flex w-full flex-col gap-[var(--space-4)]">
      <div
        class="bg-surface-subtle w-full overflow-clip rounded-[var(--radius-full)]"
        role="progressbar"
        [style.height]="trackHeight()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-valuenow]="percent()"
        aria-valuemin="0"
        aria-valuemax="100">
        <div class="bg-action h-full rounded-[var(--radius-full)]" [style.width.%]="percent()"></div>
      </div>
      @if (label()) {
        <span class="type-body text-ink-muted">{{ label() }}</span>
      }
    </div>
  `,
})
export class ProgressBarComponent {
  /** Percentage; values outside 0–100 are clamped rather than overflowing. */
  readonly value = input.required<number>();
  readonly size = input<ProgressBarSize>('small');
  /** Visible value text, e.g. `8/12`. */
  readonly label = input<string>();
  readonly ariaLabel = input('진행률');

  protected readonly percent = computed(() => Math.min(100, Math.max(0, this.value())));
  protected readonly trackHeight = computed(() => TRACK_HEIGHT[this.size()]);
}
