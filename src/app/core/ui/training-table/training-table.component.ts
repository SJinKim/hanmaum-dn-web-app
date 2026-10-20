import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MemberPillStage } from '../variant-tokens';
import { TrainingCellComponent, TrainingCellState } from './training-cell.component';

export interface TrainingTableCell {
  /** Member publicId; null for a cell without a member behind it. */
  readonly id: string | null;
  readonly label: string;
  readonly stage: MemberPillStage;
  readonly stageLabel: string;
  readonly state: TrainingCellState;
  readonly interactive: boolean;
  /** Accessible name of the cell's button when `interactive`. */
  readonly actionLabel?: string;
}

export interface TrainingTableColumn {
  readonly key: string;
  /** The 순 name — row 2. */
  readonly name: string;
  /** The 순장 — row 3; null leaves the cell blank. */
  readonly leader: TrainingTableCell | null;
  readonly cells: readonly TrainingTableCell[];
}

export interface TrainingTableDivision {
  readonly key: string;
  /** Row 1, e.g. "느헤미야". */
  readonly heading: string;
  /**
   * 새가족순: in the full table its one column has no division row of its own;
   * the heading spans rows 1 and 2 instead.
   */
  readonly spanHeader: boolean;
  readonly columns: readonly TrainingTableColumn[];
}

/** One 순 column is never narrower than this; narrower viewports scroll the columns. */
const MIN_COLUMN_WIDTH = 72;

/**
 * Figma: 양육 table — 05 · 양육 (930:95171), Desktop 215:7645, Tablet 762:47957,
 * Phone 734:38582. Cells are TrainingTable/MemberCell (1347:581), headers
 * TrainingTable/HeaderCell (1347:588).
 *
 * Row 1 is the division, row 2 the 순, row 3 the 순장 above a strong rule, then
 * one row per member. Every column is padded to the longest one so the grid
 * stays rectangular, as in the paper list.
 *
 * The label column (순 / 순장) never scrolls. `mode="all"` lays every division
 * side by side — 새가족순 spanning rows 1–2 at the right end. `mode="single"`
 * shows the given division(s) with a fixed, centred heading above the columns,
 * and only the 순 columns scroll horizontally once they no longer fit.
 */
@Component({
  selector: 'app-training-table',
  standalone: true,
  imports: [NgTemplateOutlet, TrainingCellComponent],
  template: `
    <div
      class="flex overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface"
      role="region"
      [attr.aria-label]="ariaLabel() || null">
      <div class="flex w-[48px] shrink-0 flex-col border-r border-line tablet:w-[56px]" data-testid="row-labels">
        <div class="h-[32px] border-b border-line-subtle"></div>
        <div class="type-caption flex h-[32px] items-center border-b border-line-subtle px-[var(--space-8)] text-ink-muted">
          {{ groupLabel() }}
        </div>
        <div class="type-caption flex h-[24px] items-center border-b border-line-subtle px-[var(--space-8)] text-ink-muted tablet:h-[28px]">
          {{ leaderLabel() }}
        </div>
        <div class="h-[2px] bg-line-strong"></div>
        @for (row of rows(); track $index) {
          <div class="h-[24px] border-b border-line-subtle tablet:h-[28px]"></div>
        }
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        @if (mode() === 'single') {
          @for (division of divisions(); track division.key) {
            <div class="type-body flex h-[32px] items-center justify-center border-b border-line bg-surface-subtle px-[var(--space-8)] text-ink-strong">
              {{ division.heading }}
            </div>
            <div class="overflow-x-auto" data-testid="column-scroll">
              <div class="flex">
                @for (column of division.columns; track column.key) {
                  <ng-container *ngTemplateOutlet="columnTpl; context: { $implicit: column, header: column.name, tall: false }" />
                }
              </div>
            </div>
          }
        } @else {
          <div class="flex overflow-x-auto" data-testid="column-scroll">
            @for (division of divisions(); track division.key) {
              @if (division.spanHeader) {
                @for (column of division.columns; track column.key) {
                  <ng-container *ngTemplateOutlet="columnTpl; context: { $implicit: column, header: division.heading, tall: true }" />
                }
              } @else {
                <div
                  class="flex basis-0 flex-col"
                  [attr.data-division]="division.key"
                  [style.flex-grow]="division.columns.length"
                  [style.min-width.px]="division.columns.length * minColumnWidth">
                  <div class="type-body flex h-[32px] items-center justify-center border-b border-r border-line bg-surface-subtle px-[var(--space-8)] text-ink-strong">
                    {{ division.heading }}
                  </div>
                  <div class="flex">
                    @for (column of division.columns; track column.key) {
                      <ng-container *ngTemplateOutlet="columnTpl; context: { $implicit: column, header: column.name, tall: false }" />
                    }
                  </div>
                </div>
              }
            }
          </div>
        }
      </div>
    </div>

    <ng-template #columnTpl let-column let-header="header" let-tall="tall">
      <div class="flex min-w-[72px] flex-1 basis-0 flex-col" [attr.data-column]="column.key">
        <div
          class="type-body-sm flex items-center justify-center whitespace-nowrap border-b border-r border-line bg-surface-subtle px-[var(--space-4)] text-ink-strong"
          [class.h-[32px]]="!tall"
          [class.h-[64px]]="tall">
          {{ header }}
        </div>
        <ng-container *ngTemplateOutlet="cellTpl; context: { $implicit: column.leader }" />
        <div class="h-[2px] bg-line-strong"></div>
        @for (row of rows(); track $index) {
          <ng-container *ngTemplateOutlet="cellTpl; context: { $implicit: column.cells[$index] ?? null }" />
        }
      </div>
    </ng-template>

    <ng-template #cellTpl let-cell>
      <app-training-cell
        [label]="cell?.label ?? ''"
        [stage]="cell?.stage ?? 'none'"
        [stageLabel]="cell?.stageLabel ?? ''"
        [state]="cell?.state ?? 'default'"
        [interactive]="cell?.interactive ?? false"
        [actionLabel]="cell?.actionLabel ?? ''"
        [attr.data-member]="cell?.id ?? null"
        (activated)="cellActivated.emit(cell)" />
    </ng-template>
  `,
})
export class TrainingTableComponent {
  readonly divisions = input.required<readonly TrainingTableDivision[]>();
  readonly mode = input<'all' | 'single'>('all');
  /** Row-label column texts: 순 and 순장. */
  readonly groupLabel = input.required<string>();
  readonly leaderLabel = input.required<string>();
  readonly ariaLabel = input<string>();

  readonly cellActivated = output<TrainingTableCell>();

  protected readonly minColumnWidth = MIN_COLUMN_WIDTH;

  /** One entry per member row; every column is padded to the longest. */
  protected readonly rows = computed(() => {
    const longest = Math.max(
      0,
      ...this.divisions().flatMap(d => d.columns.map(c => c.cells.length)),
    );
    return Array.from({ length: longest });
  });
}
