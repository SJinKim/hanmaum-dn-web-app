import { Component, computed, input, model, output, signal } from '@angular/core';

let nextId = 0;

export interface CommandPaletteItem {
  readonly id: string;
  readonly label: string;
}

export interface CommandPaletteGroup {
  readonly label: string;
  readonly items: readonly CommandPaletteItem[];
}

/**
 * Figma: Containers / CommandPalette (149:412).
 *
 * A panel, not a shortcut: ArrowUp/ArrowDown move the active row, Enter picks it,
 * Escape emits `dismiss`. There is deliberately no global ⌘K binding here — the
 * shell owns when the palette opens (#51). The hint line only names the shortcut.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  template: `
    <div
      class="flex w-[560px] max-w-full flex-col items-start gap-[var(--space-8)] rounded-[var(--radius-lg)] border border-line bg-surface p-[var(--space-16)] shadow-elevation-lg"
      role="dialog"
      [attr.aria-label]="ariaLabel()">
      <div class="flex w-full items-center gap-[var(--space-8)] pb-[var(--space-12)]">
        <i class="pi pi-search text-ink-muted text-[20px]" aria-hidden="true"></i>
        <input
          class="type-h3 min-w-0 flex-1 border-0 bg-transparent text-ink-strong outline-none placeholder:text-ink-muted"
          type="text"
          role="combobox"
          aria-expanded="true"
          [attr.aria-controls]="listId"
          [attr.aria-activedescendant]="activeId()"
          [attr.aria-label]="ariaLabel()"
          [placeholder]="placeholder()"
          [value]="query()"
          (input)="onInput($event)"
          (keydown.arrowDown)="move($event, 1)"
          (keydown.arrowUp)="move($event, -1)"
          (keydown.enter)="choose()"
          (keydown.escape)="dismiss.emit()" />
      </div>

      <div class="h-px w-full bg-line-subtle"></div>

      <div class="flex w-full flex-col gap-[var(--space-8)]" role="listbox" [id]="listId">
        @for (group of groups(); track group.label) {
          <div class="flex w-full flex-col gap-[var(--space-2)]">
            <p class="type-overline text-ink-muted px-[var(--space-12)]">{{ group.label }}</p>
            @for (item of group.items; track item.id) {
              <button
                class="type-body-sm flex w-full items-center rounded-[var(--radius-sm)] px-[var(--space-12)] py-[var(--space-8)] text-left text-ink focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:-2px]"
                type="button"
                role="option"
                [id]="rowId(item)"
                [class.bg-surface-subtle]="item.id === activeItem()?.id"
                [attr.aria-selected]="item.id === activeItem()?.id"
                (click)="select(item)">
                {{ item.label }}
              </button>
            }
          </div>
        }
      </div>

      @if (hint()) {
        <p class="type-caption text-ink-muted px-[var(--space-12)]">{{ hint() }}</p>
      }
    </div>
  `,
})
export class CommandPaletteComponent {
  readonly groups = input.required<readonly CommandPaletteGroup[]>();
  readonly query = model('');
  readonly placeholder = input('이동, 청년, 이벤트 검색...');
  readonly hint = input<string>();
  readonly ariaLabel = input('명령 팔레트');

  readonly selected = output<CommandPaletteItem>();
  readonly dismiss = output<void>();

  protected readonly listId = `app-command-palette-${nextId++}`;

  /** Index into the flattened item list — groups are visual only. */
  private readonly activeIndex = signal(0);

  private readonly flatItems = computed(() => this.groups().flatMap(group => group.items));

  protected readonly activeItem = computed<CommandPaletteItem | undefined>(() => {
    const items = this.flatItems();
    return items[Math.min(this.activeIndex(), items.length - 1)];
  });

  protected readonly activeId = computed(() => {
    const item = this.activeItem();
    return item ? this.rowId(item) : null;
  });

  protected rowId(item: CommandPaletteItem): string {
    return `${this.listId}-${item.id}`;
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected move(event: Event, delta: number): void {
    event.preventDefault();
    const count = this.flatItems().length;
    if (!count) return;
    this.activeIndex.set((this.activeIndex() + delta + count) % count);
  }

  protected choose(): void {
    const item = this.activeItem();
    if (item) this.selected.emit(item);
  }

  protected select(item: CommandPaletteItem): void {
    const index = this.flatItems().findIndex(candidate => candidate.id === item.id);
    if (index >= 0) this.activeIndex.set(index);
    this.selected.emit(item);
  }
}
