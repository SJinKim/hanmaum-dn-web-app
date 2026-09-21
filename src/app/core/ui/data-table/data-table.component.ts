import { booleanAttribute, Component, input, model, output } from '@angular/core';
import { Table, TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarComponent } from '../avatar/avatar.component';
import { BadgeComponent } from '../badge/badge.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { COLUMN_SORT_FIELD, COLUMN_WIDTH, DataColumn, DataRecord } from '../data-record.model';

/** Figma: Table/HeaderCell sort axis (113:69) — None / Ascending / Descending. */
const SORT_ICONS = {
  none: 'pi-sort-alt',
  ascending: 'pi-sort-amount-up',
  descending: 'pi-sort-amount-down',
} as const;

/** Rows drawn while `loading` — enough to fill the viewport without guessing. */
const SKELETON_ROWS = [0, 1, 2, 3, 4];

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
 * The sort indicator is drawn here rather than with `p-sortIcon` because Figma
 * specifies PrimeIcons glyphs; `pSortableColumn` still does the sorting and the
 * icon is read back off the table's public `sortField`/`sortOrder`.
 *
 * On Phone a screen swaps this for a list of `app-list-card` — both read
 * `DataRecord`, so no data reshaping is involved.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
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
      [rowHover]="true">
      <ng-template #colgroup>
        <colgroup>
          @for (column of columns(); track column.header) {
            <col [style.width]="column.width ?? defaultWidth(column)" />
          }
        </colgroup>
      </ng-template>

      <ng-template #header>
        <tr>
          @for (column of columns(); track column.header) {
            @if (sortFieldFor(column); as field) {
              <th class="bg-surface-base border-line border-b px-[var(--space-16)]" [pSortableColumn]="field">
                <span class="flex items-center justify-between gap-[var(--space-8)]">
                  <span class="type-overline text-ink-muted">{{ column.header }}</span>
                  <i class="pi text-ink-muted text-[16px]" [class]="sortIcon(dt, field)" aria-hidden="true"></i>
                </span>
              </th>
            } @else {
              <th class="bg-surface-base border-line type-overline text-ink-muted border-b px-[var(--space-16)]">
                {{ column.header }}
              </th>
            }
          }
        </tr>
      </ng-template>

      <ng-template #body let-row>
        @let record = asRecord(row);
        <tr
          class="border-line-subtle bg-surface hover:bg-surface-subtle border-b [height:var(--size-table-row)] focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:-2px]"
          tabindex="0"
          [class.bg-surface-subtle]="record.id === selectedId()"
          [style.box-shadow]="record.id === selectedId() ? 'inset 2px 0 0 0 var(--color-action-primary)' : null"
          (click)="select(record)"
          (keydown.enter)="select(record)"
          (keydown.space)="select(record)">
          @for (column of columns(); track column.header) {
            <td class="px-[var(--space-16)]">
              @switch (column.type) {
                @case ('avatar-name') {
                  <span class="flex items-center gap-[var(--space-8)]">
                    <app-avatar [name]="record.title" [initials]="record.initials" [size]="32" decorative />
                    <span class="type-body text-ink-strong truncate">{{ record.title }}</span>
                  </span>
                }
                @case ('badge') {
                  @if (record.badge; as badge) {
                    <app-badge [variant]="badge.variant" [label]="badge.label" />
                  }
                }
                @case ('date') {
                  <span class="type-body text-ink-muted">{{ record.meta }}</span>
                }
                @case ('progress') {
                  @if (record.progress; as progress) {
                    <app-progress-bar
                      size="small"
                      [value]="progress.value"
                      [label]="progress.label"
                      [ariaLabel]="record.title" />
                  }
                }
                @case ('actions') {
                  <span class="flex items-center gap-[var(--space-8)]">
                    <button
                      class="text-ink-muted hover:bg-surface-subtle flex size-[28px] items-center justify-center rounded-[var(--radius-md)] focus-visible:[outline:2px_solid_var(--color-focus)]"
                      type="button"
                      [pTooltip]="editLabel()"
                      [attr.aria-label]="editLabel()"
                      (click)="edit.emit(record)">
                      <i class="pi pi-pencil text-[16px]" aria-hidden="true"></i>
                    </button>
                    <button
                      class="text-ink-muted hover:bg-surface-subtle flex size-[28px] items-center justify-center rounded-[var(--radius-md)] focus-visible:[outline:2px_solid_var(--color-focus)]"
                      type="button"
                      [pTooltip]="deleteLabel()"
                      [attr.aria-label]="deleteLabel()"
                      (click)="remove.emit(record)">
                      <i class="pi pi-trash text-[16px]" aria-hidden="true"></i>
                    </button>
                  </span>
                }
                @default {
                  <span class="type-body text-ink">{{ record.subtitle }}</span>
                }
              }
            </td>
          }
        </tr>
      </ng-template>

      <ng-template #loadingbody>
        @for (skeletonRow of skeletonRows; track skeletonRow) {
          <tr class="border-line-subtle border-b [height:var(--size-table-row)]">
            @for (column of columns(); track column.header) {
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
  `,
})
export class DataTableComponent {
  /** Mutable on purpose: `p-table` takes a mutable array and sorts it in place. */
  readonly rows = input<DataRecord[]>([]);
  readonly columns = input.required<DataColumn[]>();
  readonly loading = input(false, { transform: booleanAttribute });
  /** `publicId` of the selected row — Figma's Selected row state. */
  readonly selectedId = model<string | null>(null);

  readonly emptyHeading = input('데이터가 없습니다');
  readonly emptyDescription = input<string>();
  readonly emptyVariant = input<'no-data' | 'no-results' | 'error'>('no-data');
  readonly editLabel = input('수정');
  readonly deleteLabel = input('삭제');

  readonly rowSelected = output<DataRecord>();
  readonly edit = output<DataRecord>();
  readonly remove = output<DataRecord>();

  protected readonly skeletonRows = SKELETON_ROWS;

  /** The `#body` template hands rows out untyped; this is the one cast. */
  protected asRecord(row: unknown): DataRecord {
    return row as DataRecord;
  }

  protected defaultWidth(column: DataColumn): string {
    return COLUMN_WIDTH[column.type];
  }

  /** `null` for a column that cannot sort — actions, or `sortable: false`. */
  protected sortFieldFor(column: DataColumn): string | null {
    return column.sortable === false ? null : COLUMN_SORT_FIELD[column.type];
  }

  protected sortIcon(table: Table, field: string): string {
    if (table.sortField !== field) {
      return SORT_ICONS.none;
    }
    return table.sortOrder === 1 ? SORT_ICONS.ascending : SORT_ICONS.descending;
  }

  protected select(record: DataRecord): void {
    this.selectedId.set(record.id);
    this.rowSelected.emit(record);
  }
}
