import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import {
  SummaryTraining,
  TrainingStatusGroup,
  catalogEntryByName,
  trainingOptions,
  trainingStatusGroup,
} from '../../../../core/models/member-activity.model';
import { TrainingCatalogService } from '../../../../core/services/training-catalog.service';
import { injectAppLang } from '../../../../core/i18n/language';

/** Filter model persisted by the grid. Keyed by the catalog's stable `code`. */
export interface TrainingFilterModel {
  /** "(없음)" — rows with no trainings. */
  none?: boolean;
  /** training code → required status group. */
  states?: Record<string, TrainingStatusGroup>;
}

/** Cycle order of the per-course checkbox. */
const CYCLE: TrainingStatusGroup[] = ['ACTIVE', 'COMPLETED', 'INACTIVE'];

/**
 * Four-state checkbox filter for the Training column. Each course cycles
 * off → 진행중 → 완료 → 중단 → off, so the same course can be filtered by whether it is
 * currently being worked through, already finished, or was dropped. The checkbox fill
 * mirrors the grid chip colors. A separate "(없음)" box matches members with no
 * trainings. A row passes if it satisfies any selected state (OR within the column —
 * AG-Grid ANDs across columns).
 *
 * The course list comes from the training catalog, so a course added on the server
 * shows up here without a frontend change.
 */
@Component({
  selector: 'app-training-filter',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="w-52 p-2 text-[12px] text-primary">
      @for (t of trainings(); track t.value) {
        <button
          type="button"
          class="flex items-center gap-2 w-full h-8 px-1 rounded-md text-left hover:bg-gray-50 cursor-pointer"
          (click)="cycle(t.value)"
        >
          <span
            class="box"
            [class.box--active]="stateOf(t.value) === 'ACTIVE'"
            [class.box--done]="stateOf(t.value) === 'COMPLETED'"
            [class.box--stopped]="stateOf(t.value) === 'INACTIVE'"
          >
            @if (stateOf(t.value) === 'ACTIVE') { – }
            @else if (stateOf(t.value) === 'COMPLETED') { ✓ }
            @else if (stateOf(t.value) === 'INACTIVE') { ✕ }
          </span>
          <span class="truncate">{{ t.label }}</span>
        </button>
      }

      <button
        type="button"
        class="flex items-center gap-2 w-full h-8 px-1 rounded-md text-left hover:bg-gray-50 cursor-pointer"
        (click)="toggleNone()"
      >
        <span class="box" [class.box--none]="noneSelected()">
          @if (noneSelected()) { ✓ }
        </span>
        <span>{{ 'common.none' | translate }}</span>
      </button>

      <p class="mt-2 px-1 text-[10px] leading-tight text-tertiary">
        {{ 'members.filter.trainingHint' | translate }}
      </p>
    </div>
  `,
  styles: [`
    .box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1px solid #d1d5db;
      background: #ffffff;
      font-size: 11px;
      line-height: 1;
      flex: none;
    }
    /* Mirrors the grid chip colors. */
    .box--active  { background: #ffedd5; border-color: #c2410c; color: #c2410c; }
    .box--done    { background: #f3f4f6; border-color: #4b5563; color: #4b5563; }
    .box--stopped { background: #fee2e2; border-color: #b91c1c; color: #b91c1c; }
    .box--none    { background: #1f2937; border-color: #1f2937; color: #ffffff; }
  `],
})
export class TrainingFilterComponent implements IFilterAngularComp {
  private readonly catalog = inject(TrainingCatalogService);
  private readonly lang    = injectAppLang();

  /** Active catalog courses, in catalog order, labelled in the active language. */
  readonly trainings = computed(() =>
    trainingOptions(this.catalog.entries(), this.lang()));

  private params!: IFilterParams;
  private none = false;
  private states = new Map<string, TrainingStatusGroup>();

  agInit(params: IFilterParams): void {
    this.params = params;
  }

  isFilterActive(): boolean {
    return this.none || this.states.size > 0;
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.isFilterActive()) return true;
    const trainings = (params.data as { trainings?: SummaryTraining[] } | undefined)?.trainings ?? [];
    if (this.none && trainings.length === 0) return true;
    for (const [code, group] of this.states) {
      if (trainings.some(t => this.codeOf(t) === code && trainingStatusGroup(t.status) === group)) {
        return true;
      }
    }
    return false;
  }

  getModel(): TrainingFilterModel | null {
    if (!this.isFilterActive()) return null;
    const model: TrainingFilterModel = {};
    if (this.none) model.none = true;
    if (this.states.size > 0) model.states = Object.fromEntries(this.states);
    return model;
  }

  setModel(model: TrainingFilterModel | null): void {
    this.none = !!model?.none;
    this.states = new Map(Object.entries(model?.states ?? {}));
  }

  // --- template helpers ---

  noneSelected(): boolean {
    return this.none;
  }

  stateOf(code: string): TrainingStatusGroup | undefined {
    return this.states.get(code);
  }

  toggleNone(): void {
    this.none = !this.none;
    this.params.filterChangedCallback();
  }

  /** off → ACTIVE → COMPLETED → INACTIVE → off */
  cycle(code: string): void {
    const current = this.states.get(code);
    const next = current ? CYCLE[CYCLE.indexOf(current) + 1] : CYCLE[0];
    if (next) this.states.set(code, next);
    else this.states.delete(code);
    this.params.filterChangedCallback();
  }

  /** The catalog code behind a row's training, joined on the DTO's English name. */
  private codeOf(t: SummaryTraining): string | undefined {
    return catalogEntryByName(this.catalog.entries(), t.name)?.code;
  }
}
