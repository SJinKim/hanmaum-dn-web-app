import { Component, ElementRef, computed, inject, input, output, viewChild } from '@angular/core';
import { Popover, PopoverModule } from 'primeng/popover';
import { FilterChipComponent } from '../filter-chip/filter-chip.component';

export interface FilterSelectOption<T> {
  label: string;
  value: T | null;
}

/**
 * Figma: 청년 · 필터 칩 (열림) (949:96712 Light, 949:96931 Dark).
 *
 * A {@link FilterChipComponent} that opens a single-select popover. The chip
 * reads `label` while nothing is chosen and `label · option` once a value is
 * set, and is Selected then. The option with `value: null` is 전체 and clears
 * the filter. The chosen option carries the MenuItem Hover state, as in Figma.
 */
@Component({
  selector: 'app-filter-select',
  standalone: true,
  // The chip's own button takes the click (and Enter/Space); it bubbles to the
  // host, which anchors the popover. The popover renders into body, so its own
  // clicks never reach this listener.
  host: { class: 'inline-flex', '(click)': 'toggle($event)' },
  imports: [FilterChipComponent, PopoverModule],
  template: `
    <app-filter-chip [label]="chipLabel()" [selected]="selectedOption() !== null" />
    <p-popover #popover appendTo="body" [pt]="{ content: { class: 'p-[var(--space-4)]' } }">
      <ul class="flex min-w-[170px] flex-col gap-[var(--space-2)]" role="listbox" [attr.aria-label]="label()">
        @for (option of options(); track option.value) {
          <li
            class="type-body-sm cursor-pointer rounded-[var(--radius-sm)] px-[var(--space-12)] py-[var(--space-8)] text-ink hover:bg-surface-subtle"
            role="option"
            tabindex="0"
            [class.bg-surface-subtle]="option.value === value()"
            [attr.aria-selected]="option.value === value()"
            (click)="choose(option.value)"
            (keydown.enter)="choose(option.value)"
            (keydown.space)="$event.preventDefault(); choose(option.value)">
            {{ option.label }}
          </li>
        }
      </ul>
    </p-popover>
  `,
})
export class FilterSelectComponent<T> {
  /** Column name, e.g. 상태; also the listbox's accessible name. */
  readonly label = input.required<string>();
  readonly options = input.required<readonly FilterSelectOption<T>[]>();
  readonly value = input<T | null>(null);

  readonly valueChange = output<T | null>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly popover = viewChild.required<Popover>('popover');

  /** `null` while 전체 is chosen — the chip then shows the bare column name. */
  readonly selectedOption = computed(() => {
    const value = this.value();
    return value === null ? null : (this.options().find(o => o.value === value) ?? null);
  });

  readonly chipLabel = computed(() => {
    const option = this.selectedOption();
    return option ? `${this.label()} · ${option.label}` : this.label();
  });

  protected toggle(event: Event): void {
    this.popover().toggle(event, this.host.nativeElement);
  }

  protected choose(value: T | null): void {
    this.popover().hide();
    if (value !== this.value()) this.valueChange.emit(value);
  }
}
