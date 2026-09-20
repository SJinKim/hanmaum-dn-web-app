import { Component, input, model } from '@angular/core';

export interface SegmentOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Figma: Controls / SegmentedControl (86:100), Segment (84:155).
 *
 * Replaces a dropdown for 2–4 mutually exclusive options. The selected segment
 * lifts onto bg/surface with Elevation/sm; the others stay transparent on the
 * subtle track. Segment is not used standalone, so it has no component of its
 * own here. Track 40 / segment 32 are literal — Density has no token for either.
 */
@Component({
  selector: 'app-segmented-control',
  standalone: true,
  template: `
    <div
      class="flex h-[40px] items-center gap-[var(--space-2)] rounded-[var(--radius-md)] bg-surface-subtle p-[var(--space-2)]"
      role="group"
      [attr.aria-label]="ariaLabel()">
      @for (option of options(); track option.value) {
        <button
          class="type-body-sm flex h-[32px] min-w-px flex-1 items-center justify-center rounded-[var(--radius-sm)] px-[var(--space-12)] focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:2px]"
          type="button"
          [class]="segmentClass(option.value)"
          [attr.aria-pressed]="option.value === value()"
          (click)="value.set(option.value)">
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class SegmentedControlComponent {
  readonly options = input.required<readonly SegmentOption[]>();
  readonly value = model<string>('');
  readonly ariaLabel = input<string>();

  /** Figma states: Selected False/True × Default/Hover. */
  protected segmentClass(value: string): string {
    return value === this.value()
      ? 'bg-surface text-ink-strong shadow-elevation-sm'
      : 'bg-transparent text-ink-muted hover:text-ink';
  }
}
