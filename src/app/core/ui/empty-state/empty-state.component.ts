import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/** Figma variant axis: NoData / NoResults / Error. */
export type EmptyStateVariant = 'no-data' | 'no-results' | 'error';

const VARIANT_ICONS: Record<EmptyStateVariant, string> = {
  'no-data': 'pi pi-th-large',
  'no-results': 'pi pi-search',
  error: 'pi pi-exclamation-triangle',
};

/**
 * Figma: Containers / EmptyState (148:668).
 *
 * The variant picks the icon; the copy comes from the caller so no untranslated
 * Korean literal lives in a shared component. Error is the only variant that
 * carries an action by default in Figma ("다시 시도") — that too is the caller's
 * call here, via `actionLabel`.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <div class="flex w-full flex-col items-center justify-center gap-[var(--space-12)] p-[var(--space-48)]">
      <i class="text-ink-disabled text-[32px]" [class]="icon()" aria-hidden="true"></i>
      <h3 class="type-h3 text-ink-strong text-center">{{ heading() }}</h3>
      @if (description()) {
        <p class="type-body text-ink-muted text-center">{{ description() }}</p>
      }
      @if (actionLabel()) {
        <p-button
          size="small"
          [text]="true"
          severity="secondary"
          [label]="actionLabel()"
          [icon]="actionIcon()"
          (onClick)="action.emit()" />
      }
    </div>
  `,
})
export class EmptyStateComponent {
  readonly variant = input<EmptyStateVariant>('no-data');
  readonly heading = input.required<string>();
  readonly description = input<string>();
  readonly actionLabel = input<string>();
  readonly actionIcon = input<string>();

  readonly action = output<void>();

  protected readonly icon = computed(() => VARIANT_ICONS[this.variant()]);
}
