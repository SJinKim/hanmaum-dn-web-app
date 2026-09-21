import { Component, computed, input } from '@angular/core';
import { badgeTokens, BadgeVariant } from '../variant-tokens';

/** Figma: Badge Size axis (95:42). Small = overline, Medium = caption. */
export type BadgeSize = 'small' | 'medium';

const SIZE_CLASSES: Record<BadgeSize, string> = {
  small: 'type-overline px-[var(--space-6)] py-[var(--space-2)]',
  medium: 'type-caption px-[var(--space-8)] py-[var(--space-4)]',
};

/**
 * Figma: Data / Badge (95:42) — 20 symbols across Variant × Size.
 *
 * One component, one `variant` input; the name → token mapping lives in
 * `variant-tokens.ts` and nowhere else. `label` is required because the colour
 * is never allowed to be the only signal for a status.
 *
 * The variant is typed but resolved defensively: a value arriving from an API
 * that this build does not know falls back to `neutral` rather than emitting an
 * undefined custom property.
 */
@Component({
  selector: 'app-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex w-fit items-center justify-center whitespace-nowrap rounded-[var(--radius-sm)]"
      [class]="sizeClass()"
      [style.background]="tokens().background"
      [style.color]="tokens().color">
      {{ label() }}
    </span>
  `,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('neutral');
  readonly label = input.required<string>();
  readonly size = input<BadgeSize>('small');

  protected readonly tokens = computed(() => badgeTokens(this.variant()));
  protected readonly sizeClass = computed(() => SIZE_CLASSES[this.size()]);
}
