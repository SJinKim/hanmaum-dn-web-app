import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';

/** Token for the null/empty ("(없음)") bucket, so it can be checked like any value. */
export const NULL_TOKEN = ' __null__';

/** A single checkbox option. `token` is the value matched against the row. */
export interface SetFilterOption {
  token: string;
  label: string;
}

/** Filter model persisted by the grid (`getModel`/`setModel`). */
export interface SetFilterModel {
  values: string[];
}

/**
 * Per-column configuration passed via `colDef.filterParams`. AG-Grid merges these
 * onto the params object handed to {@link SetFilterComponent.agInit}.
 */
export interface SetFilterParams {
  /**
   * The full, ordered option list — sourced from the backing table/enum, NOT from the
   * loaded rows. A function so async-loaded lists (church groups, ministries) are read
   * fresh each time the popup opens. Include a {@link NULL_TOKEN} option to offer "(없음)".
   */
  options: () => SetFilterOption[];
  /** Values a row contributes — one (Status/Baptism/Group) or many (Ministry). */
  optionValues: (data: unknown) => (string | null | undefined)[];
}

/**
 * Reusable AG-Grid (Community) checkbox/set filter. Renders a fixed, ordered list of
 * options (from the backing table/enum) as checkboxes; a row passes if any of its
 * values is checked (OR within the column — AG-Grid ANDs across columns). An empty
 * selection means "no filter". Configure per column via {@link SetFilterParams}.
 */
@Component({
  selector: 'app-set-filter',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="w-56 p-2 text-[12px] text-primary">
      <input
        type="text"
        class="w-full mb-2 h-8 px-2 outline-none border border-gray-200 rounded-md
               text-[12px] placeholder:text-tertiary"
        placeholder="Search…"
        aria-label="Filter options"
        [(ngModel)]="searchText"
      />

      <div class="flex items-center justify-between mb-1 px-1">
        <button
          type="button"
          class="text-[11px] font-bold text-primary hover:underline"
          (click)="selectAll()"
        >Select all</button>
        <button
          type="button"
          class="text-[11px] font-bold text-tertiary hover:underline"
          (click)="clear()"
        >Clear</button>
      </div>

      <div class="max-h-56 overflow-y-auto">
        @for (opt of filteredOptions(); track opt.token) {
          <label class="flex items-center gap-2 h-8 px-1 rounded-md hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              [checked]="isSelected(opt.token)"
              (change)="toggle(opt.token)"
            />
            <span class="truncate">{{ opt.label }}</span>
          </label>
        } @empty {
          <div class="px-1 py-2 text-tertiary">No options</div>
        }
      </div>
    </div>
  `,
})
export class SetFilterComponent implements IFilterAngularComp {
  searchText = '';

  private params!: IFilterParams & SetFilterParams;
  private options: SetFilterOption[] = [];
  private readonly selected = new Set<string>();

  agInit(params: IFilterParams & SetFilterParams): void {
    this.params = params;
    this.options = params.options();
  }

  /** Re-read the option provider each time the popup is shown (picks up async loads). */
  afterGuiAttached(): void {
    this.searchText = '';
    this.options = this.params.options();
  }

  isFilterActive(): boolean {
    return this.selected.size > 0;
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (this.selected.size === 0) return true;
    return this.tokensFor(params.data).some(token => this.selected.has(token));
  }

  getModel(): SetFilterModel | null {
    return this.selected.size > 0 ? { values: [...this.selected] } : null;
  }

  setModel(model: SetFilterModel | null): void {
    this.selected.clear();
    for (const value of model?.values ?? []) this.selected.add(value);
  }

  // --- template helpers ---

  filteredOptions(): SetFilterOption[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.options;
    return this.options.filter(o => o.label.toLowerCase().includes(q));
  }

  isSelected(token: string): boolean {
    return this.selected.has(token);
  }

  toggle(token: string): void {
    if (this.selected.has(token)) this.selected.delete(token);
    else this.selected.add(token);
    this.params.filterChangedCallback();
  }

  selectAll(): void {
    for (const opt of this.filteredOptions()) this.selected.add(opt.token);
    this.params.filterChangedCallback();
  }

  clear(): void {
    this.selected.clear();
    this.params.filterChangedCallback();
  }

  // --- internals ---

  /** Tokens a row contributes; an empty/absent value folds into the null bucket. */
  private tokensFor(data: unknown): string[] {
    const raw = this.params.optionValues(data);
    const tokens = raw.filter(v => v != null && v !== '').map(v => v as string);
    return tokens.length > 0 ? tokens : [NULL_TOKEN];
  }
}
