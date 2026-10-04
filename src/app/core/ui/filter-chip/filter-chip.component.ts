import { booleanAttribute, Component, input, output } from '@angular/core';

/**
 * Figma: Containers / FilterChip (100:157).
 *
 * Selected = the filter is active (action/primary fill, no visible stroke — the
 * border stays transparent so toggling does not shift layout). `count` adds an
 * inline count pill, `removable` a trailing times button that emits `removed`
 * without toggling the chip.
 *
 * The chip is a wrapper with two sibling buttons rather than one button holding
 * another: nesting interactive elements is invalid and breaks keyboard order.
 */
@Component({
  selector: 'app-filter-chip',
  standalone: true,
  template: `
    <span
      class="type-body-sm inline-flex items-center justify-center gap-[var(--space-8)] rounded-[var(--radius-full)] border px-[var(--space-12)] [height:var(--size-control-sm)] focus-within:[outline:2px_solid_var(--color-focus)] focus-within:[outline-offset:2px]"
      [class]="chipClass()">
      <button
        class="inline-flex items-center gap-[var(--space-8)] outline-none"
        type="button"
        [attr.aria-pressed]="selected()"
        (click)="toggled.emit(!selected())">
        <span>{{ label() }}</span>
        @if (count() !== undefined) {
          <span class="type-caption rounded-[var(--radius-full)] px-[var(--space-6)]" [class]="countClass()">
            {{ count() }}
          </span>
        }
      </button>
      @if (removable()) {
        <button
          class="inline-flex items-center outline-none"
          type="button"
          [attr.aria-label]="removeLabel()"
          (click)="removed.emit()">
          <i class="pi pi-times text-[16px]" aria-hidden="true"></i>
        </button>
      }
    </span>
  `,
})
export class FilterChipComponent {
  readonly label = input.required<string>();
  readonly selected = input(false, { transform: booleanAttribute });
  readonly removable = input(false, { transform: booleanAttribute });
  readonly count = input<number | undefined>(undefined);
  /** Accessible name for the trailing remove button. */
  readonly removeLabel = input('필터 제거');

  readonly toggled = output<boolean>();
  readonly removed = output<void>();

  /** Figma states: Selected False/True × Default/Hover. */
  protected chipClass(): string {
    return this.selected()
      ? 'border-transparent bg-action text-action-on hover:bg-action-hover'
      : 'border-line bg-surface text-ink hover:bg-surface-subtle';
  }

  protected countClass(): string {
    return this.selected() ? 'bg-action-hover text-action-on' : 'bg-surface-subtle text-ink-muted';
  }
}
