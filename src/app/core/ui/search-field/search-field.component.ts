import { booleanAttribute, Component, input, model, output } from '@angular/core';

let nextId = 0;

/**
 * Figma: Controls / SearchField (79:143).
 *
 * Search input with a leading search icon and an optional trailing clear
 * button. PrimeNG's IconField/InputText pair cannot carry the trailing clear
 * button without a wrapper, so the field is built from the token layer directly
 * — the same borders, heights and radii the preset gives `p-inputtext`.
 */
@Component({
  selector: 'app-search-field',
  standalone: true,
  template: `
    <div class="flex w-full flex-col items-start gap-[var(--space-4)]">
      @if (label()) {
        <label class="type-caption text-ink" [for]="inputId">{{ label() }}</label>
      }

      <div
        class="flex w-full items-center gap-[var(--space-8)] rounded-[var(--radius-md)] border px-[var(--space-12)] [height:var(--size-control-md)] focus-within:[outline:2px_solid_var(--color-focus)] focus-within:[outline-offset:2px]"
        [class]="fieldClass()">
        <i class="pi pi-search text-[16px] text-ink-muted" aria-hidden="true"></i>
        <input
          class="type-body-sm min-w-0 flex-1 border-0 bg-transparent text-ink outline-none placeholder:text-ink-muted disabled:text-ink-disabled"
          type="search"
          [id]="inputId"
          [attr.aria-invalid]="invalid() || null"
          [attr.aria-describedby]="hint() ? hintId : null"
          [disabled]="disabled()"
          [placeholder]="placeholder()"
          [value]="value()"
          (input)="onInput($event)" />
        @if (value() && !disabled()) {
          <button
            class="flex items-center text-ink-muted hover:text-ink focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:2px]"
            type="button"
            [attr.aria-label]="clearLabel()"
            (click)="clear()">
            <i class="pi pi-times text-[14px]" aria-hidden="true"></i>
          </button>
        }
      </div>

      @if (hint()) {
        <p class="type-caption" [id]="hintId" [class]="invalid() ? 'text-[color:var(--color-badge-deleted-fg)]' : 'text-ink-muted'">
          {{ hint() }}
        </p>
      }
    </div>
  `,
})
export class SearchFieldComponent {
  readonly value = model('');
  readonly label = input<string>();
  readonly hint = input<string>();
  readonly placeholder = input('전체 항목 검색...');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  /** Accessible name for the trailing clear button. */
  readonly clearLabel = input('지우기');

  readonly cleared = output<void>();

  protected readonly inputId = `app-search-field-${nextId++}`;
  protected readonly hintId = `${this.inputId}-hint`;

  /** Figma states: Default / Hover / Focus / Error / Disabled. */
  protected fieldClass(): string {
    if (this.disabled()) return 'bg-surface-subtle border-line-subtle';
    if (this.invalid()) return 'bg-surface border-[color:var(--color-badge-deleted-fg)]';
    return 'bg-surface border-line hover:border-line-strong';
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    this.value.set('');
    this.cleared.emit();
  }
}
