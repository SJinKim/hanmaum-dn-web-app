import { NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, Component, computed, contentChildren, input, model, output, TemplateRef } from '@angular/core';
import { Table, TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarComponent } from '../avatar/avatar.component';
import { BadgeComponent } from '../badge/badge.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import {
  asBadge,
  asProgress,
  cellText,
  cellValue,
  COLUMN_WIDTH,
  columnId,
  columnSortField,
  columnTone,
  DataCellValue,
  DataColumn,
  DataColumnTone,
  DataRecord,
} from '../data-record.model';
import { DataCellContext, DataCellDirective } from './data-cell.directive';

/** Figma: Table/HeaderCell sort axis (113:69) — None / Ascending / Descending. */
const SORT_ICONS = {
  none: 'pi-sort-alt',
  ascending: 'pi-sort-amount-up-alt',
  descending: 'pi-sort-amount-down',
} as const;

const TONE_CLASS: Record<DataColumnTone, string> = {
  strong: 'text-ink-strong',
  default: 'text-ink',
  muted: 'text-ink-muted',
};

/** Rows drawn while `loading` — enough to fill the viewport without guessing. */
const SKELETON_ROWS = [0, 1, 2, 3, 4];

/** The sort a screen applied itself, e.g. on the server — see `externalSort`. */
export interface DataTableSort {
  /** A column's `sortKey`. */
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

/**
 * Figma: Data / Table — HeaderCell (113:69), Cell (114:85), Row (114:215),
 * assembly (117:136).
 *
 * "Table is an assembly pattern, not a component set": the three Figma symbols
 * are the header cell, the body cell and the row, and this component is the
 * assembly of them over PrimeNG's `p-table` — so sorting, scrolling and the
 * a11y table semantics stay PrimeNG's job. Row height comes from
 * `--size-table-row`, which Density redefines per breakpoint.
 *
 * Every column reads either a named `DataRecord` field or, with `key`, one of
 * the record's `cells`; a `custom` column renders the screen's
 * `ng-template[appDataCell]` of the same key (#69).
 *
 * Sorting is PrimeNG's `pSortableColumn` on the rows it holds. A screen that
 * sorts elsewhere — a paged list sorted by the server — sets `externalSort`:
 * the header then only reports the click (`sortChange`) and shows `sort`.
 * The indicator is drawn here rather than with `p-sortIcon` because Figma
 * specifies PrimeIcons glyphs.
 *
 * On Phone a screen swaps this for a list of `app-list-card` — both read
 * `DataRecord`, so no data reshaping is involved.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TableModule,
    TooltipModule,
    AvatarComponent,
    BadgeComponent,
    EmptyStateComponent,
    ProgressBarComponent,
    SkeletonComponent,
  ],
  template: `
    <p-table
      #dt
      dataKey="id"
      styleClass="w-full"
      [value]="rows()"
      [loading]="loading()"
      [showLoader]="false"
      [rowHover]="selectable()">
      <ng-template #colgroup>
        @if (caption(); as text) {
          <caption class="sr-only">{{ text }}</caption>
        }
        <colgroup>
          @for (column of columns(); track trackColumn(column)) {
            <col [style.width]="column.width ?? defaultWidth(column)" />
          }
        </colgroup>
      </ng-template>

      <ng-template #header>
        <tr>
          @for (column of columns(); track trackColumn(column)) {
            @let field = sortField(column);
            @if (field && externalSort()) {
              <th
                class="bg-surface-base border-line border-b px-[var(--space-16)]"
                [class]="headerClass()"
                [attr.aria-sort]="ariaSort(field)">
                <button
                  class="flex w-full items-center justify-between gap-[var(--space-8)] rounded-[var(--radius-sm)] text-left focus-visible:[outline:2px_solid_var(--color-focus)]"
                  type="button"
                  (click)="sortChange.emit(field)">
                  <span class="type-overline text-ink-muted">{{ column.header }}</span>
                  <i class="pi text-ink-muted text-[16px]" [class]="externalSortIcon(field)" aria-hidden="true"></i>
                </button>
              </th>
            } @else if (field) {
              <th class="bg-surface-base border-line border-b px-[var(--space-16)]" [class]="headerClass()" [pSortableColumn]="field">
                <span class="flex items-center justify-between gap-[var(--space-8)]">
                  <span class="type-overline text-ink-muted">{{ column.header }}</span>
                  <i class="pi text-ink-muted text-[16px]" [class]="sortIcon(dt, field)" aria-hidden="true"></i>
                </span>
              </th>
            } @else {
              <th
                class="bg-surface-base border-line type-overline text-ink-muted border-b px-[var(--space-16)]"
                [class]="headerClass()"
                [class.text-right]="column.align === 'end'">
                {{ column.header }}
              </th>
            }
          }
        </tr>
      </ng-template>

      <ng-template #body let-row>
        @let record = asRecord(row);
        @if (selectable()) {
          <tr
            class="border-line-subtle bg-surface hover:bg-surface-subtle border-b cursor-pointer [height:var(--size-table-row)] focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:-2px]"
            tabindex="0"
            [class.bg-surface-subtle]="record.id === selectedId()"
            [style.box-shadow]="record.id === selectedId() ? 'inset 2px 0 0 0 var(--color-action-primary)' : null"
            (click)="select(record)"
            (keydown.enter)="onRowKey($event, record)"
            (keydown.space)="onRowKey($event, record)">
            @for (column of columns(); track trackColumn(column)) {
              <td class="px-[var(--space-16)]" [class.text-right]="column.align === 'end'">
                <ng-container *ngTemplateOutlet="cell; context: { $implicit: record, column }" />
              </td>
            }
          </tr>
        } @else {
          <tr class="border-line-subtle bg-surface border-b [height:var(--size-table-row)]">
            @for (column of columns(); track trackColumn(column)) {
              <td class="px-[var(--space-16)]" [class.text-right]="column.align === 'end'">
                <ng-container *ngTemplateOutlet="cell; context: { $implicit: record, column }" />
              </td>
            }
          </tr>
        }
      </ng-template>

      <!-- this.footer(): the #footer template ref would shadow the footer input. -->
      <ng-template #footer>
        @if (this.footer(); as total) {
          <tr class="[height:var(--size-table-row)]">
            @for (column of columns(); track trackColumn(column)) {
              <td
                class="type-body text-ink-strong px-[var(--space-16)] font-semibold tabular-nums"
                [class.text-right]="column.align === 'end'">
                {{ text(total, column) }}
              </td>
            }
          </tr>
        }
      </ng-template>

      <ng-template #loadingbody>
        @for (skeletonRow of skeletonRows; track skeletonRow) {
          <tr class="border-line-subtle border-b [height:var(--size-table-row)]">
            @for (column of columns(); track trackColumn(column)) {
              <td class="px-[var(--space-16)]"><app-skeleton /></td>
            }
          </tr>
        }
      </ng-template>

      <ng-template #emptymessage>
        <tr>
          <td [attr.colspan]="columns().length">
            <app-empty-state [variant]="emptyVariant()" [heading]="emptyHeading()" [description]="emptyDescription()" />
          </td>
        </tr>
      </ng-template>
    </p-table>

    <ng-template #cell let-record let-column="column">
      @switch (asColumn(column).type) {
        @case ('avatar-name') {
          <span class="flex items-center gap-[var(--space-8)]">
            <app-avatar [name]="asRecord(record).title" [initials]="asRecord(record).initials" [size]="32" decorative />
            <span class="type-body text-ink-strong truncate">{{ asRecord(record).title }}</span>
          </span>
        }
        @case ('badge') {
          @let value = valueOf(record, column);
          @if (badgeOf(value); as badge) {
            <app-badge [variant]="badge.variant" [label]="badge.label" />
          } @else {
            <span class="type-body tabular-nums" [class]="toneClass(column)">{{ textOf(value) }}</span>
          }
        }
        @case ('progress') {
          @let value = valueOf(record, column);
          @if (progressOf(value); as progress) {
            <app-progress-bar
              size="small"
              [value]="progress.value"
              [label]="progress.label"
              [ariaLabel]="asRecord(record).title" />
          } @else {
            <span class="type-body tabular-nums" [class]="toneClass(column)">{{ textOf(value) }}</span>
          }
        }
        @case ('actions') {
          <span class="flex items-center gap-[var(--space-8)]">
            <button
              class="text-ink-muted hover:bg-surface-subtle flex size-[28px] items-center justify-center rounded-[var(--radius-md)] focus-visible:[outline:2px_solid_var(--color-focus)]"
              type="button"
              [pTooltip]="editLabel()"
              [attr.aria-label]="editLabel()"
              (click)="$event.stopPropagation(); edit.emit(record)">
              <i class="pi pi-pencil text-[16px]" aria-hidden="true"></i>
            </button>
            <button
              class="text-ink-muted hover:bg-surface-subtle flex size-[28px] items-center justify-center rounded-[var(--radius-md)] focus-visible:[outline:2px_solid_var(--color-focus)]"
              type="button"
              [pTooltip]="deleteLabel()"
              [attr.aria-label]="deleteLabel()"
              (click)="$event.stopPropagation(); remove.emit(record)">
              <i class="pi pi-trash text-[16px]" aria-hidden="true"></i>
            </button>
          </span>
        }
        @case ('custom') {
          @if (customCell(column); as template) {
            <ng-container *ngTemplateOutlet="template; context: { $implicit: record }" />
          }
        }
        @default {
          <span class="type-body tabular-nums" [class]="toneClass(column)">{{ text(record, column) }}</span>
        }
      }
    </ng-template>
  `,
})
export class DataTableComponent {
  /** Mutable on purpose: `p-table` takes a mutable array and sorts it in place. */
  readonly rows = input<DataRecord[]>([]);
  readonly columns = input.required<DataColumn[]>();
  readonly loading = input(false, { transform: booleanAttribute });
  /** `publicId` of the selected row — Figma's Selected row state. */
  readonly selectedId = model<string | null>(null);
  /** False for a read-only table: rows take no focus, no click, no hover. */
  readonly selectable = input(true, { transform: booleanAttribute });
  /** Accessible name of the table, rendered as a visually hidden `<caption>`. */
  readonly caption = input<string>();
  /** A summary row under the body, e.g. 합계 — rendered as text in every column. */
  readonly footer = input<DataRecord | null>(null);
  /**
   * Keeps the header in view while an ancestor scrolls. The table itself does
   * not scroll, so the header sticks to the nearest scrolling container.
   */
  readonly stickyHeader = input(false, { transform: booleanAttribute });

  /** Sorting happens outside: headers emit `sortChange` and show `sort`. */
  readonly externalSort = input(false, { transform: booleanAttribute });
  /** The applied sort in `externalSort` mode; `null` shows every column unsorted. */
  readonly sort = input<DataTableSort | null>(null);

  readonly emptyHeading = input('데이터가 없습니다');
  readonly emptyDescription = input<string>();
  readonly emptyVariant = input<'no-data' | 'no-results' | 'error'>('no-data');
  readonly editLabel = input('수정');
  readonly deleteLabel = input('삭제');

  readonly rowSelected = output<DataRecord>();
  readonly edit = output<DataRecord>();
  readonly remove = output<DataRecord>();
  /** `externalSort` only: the `sortKey` of the header that was clicked. */
  readonly sortChange = output<string>();

  private readonly cellTemplates = contentChildren(DataCellDirective);
  private readonly templatesByKey = computed(
    () => new Map(this.cellTemplates().map(cell => [cell.key(), cell.template] as const)),
  );

  protected readonly headerClass = computed(() => (this.stickyHeader() ? 'sticky top-0 z-[1]' : ''));
  protected readonly skeletonRows = SKELETON_ROWS;

  /** The `#body` template hands rows out untyped; this is the one cast. */
  protected asRecord(row: unknown): DataRecord {
    return row as DataRecord;
  }

  protected asColumn(column: unknown): DataColumn {
    return column as DataColumn;
  }

  protected trackColumn(column: DataColumn): string {
    return columnId(column);
  }

  protected defaultWidth(column: DataColumn): string {
    return COLUMN_WIDTH[column.type];
  }

  protected sortField(column: DataColumn): string | null {
    return columnSortField(column);
  }

  protected valueOf(record: unknown, column: unknown): DataCellValue {
    return cellValue(this.asRecord(record), this.asColumn(column));
  }

  protected text(record: unknown, column: unknown): string {
    return cellText(this.valueOf(record, column));
  }

  protected textOf(value: DataCellValue): string {
    return cellText(value);
  }

  protected badgeOf = asBadge;
  protected progressOf = asProgress;

  protected toneClass(column: unknown): string {
    return TONE_CLASS[columnTone(this.asColumn(column))];
  }

  protected customCell(column: unknown): TemplateRef<DataCellContext> | null {
    const key = this.asColumn(column).key;
    return key ? (this.templatesByKey().get(key) ?? null) : null;
  }

  protected sortIcon(table: Table, field: string): string {
    if (table.sortField !== field) {
      return SORT_ICONS.none;
    }
    return table.sortOrder === 1 ? SORT_ICONS.ascending : SORT_ICONS.descending;
  }

  protected ariaSort(field: string): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    if (sort?.field !== field) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected externalSortIcon(field: string): string {
    return SORT_ICONS[this.ariaSort(field)];
  }

  /** Enter/Space on the row itself — not on a button or select inside a cell. */
  protected onRowKey(event: Event, record: DataRecord): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    this.select(record);
  }

  protected select(record: DataRecord): void {
    this.selectedId.set(record.id);
    this.rowSelected.emit(record);
  }
}
