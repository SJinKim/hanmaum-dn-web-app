import { Component } from '@angular/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import {
  SummaryTraining,
  TrainingStatus,
} from '../../../../core/models/member-activity.model';

/** Fixed training options, in the requested display order. `name` matches the
 * catalog/DTO name on each {@link SummaryTraining} ('QTBS' | '1on1' | 'Discipleship'). */
const TRAININGS: { name: string; label: string }[] = [
  { name: 'QTBS', label: '큐베세' },
  { name: '1on1', label: '1대1' },
  { name: 'Discipleship', label: '제자반' },
];

/** Filter model persisted by the grid. */
export interface TrainingFilterModel {
  /** "(없음)" — rows with no trainings. */
  none?: boolean;
  /** training name → required status (in-progress vs completed). */
  states?: Record<string, TrainingStatus>;
}

/**
 * Tri-state checkbox filter for the Training column. Each training cycles
 * off → IN_PROGRESS → COMPLETED → off, so the same training can be filtered by
 * whether it is currently active or already completed. The checkbox fill mirrors the
 * grid chip colors (orange = in progress, grey = completed). A separate "(없음)" box
 * matches members with no trainings. A row passes if it satisfies any selected state
 * (OR within the column — AG-Grid ANDs across columns).
 */
@Component({
  selector: 'app-training-filter',
  standalone: true,
  template: `
    <div class="w-44 p-2 text-[12px] text-primary">
      @for (t of trainings; track t.name) {
        <div
          class="flex items-center gap-2 h-8 px-1 rounded-md hover:bg-gray-50 cursor-pointer"
          (click)="cycle(t.name)"
        >
          <span
            class="box"
            [class.box--active]="stateOf(t.name) === 'IN_PROGRESS'"
            [class.box--done]="stateOf(t.name) === 'COMPLETED'"
          >
            @if (stateOf(t.name) === 'IN_PROGRESS') { – }
            @else if (stateOf(t.name) === 'COMPLETED') { ✓ }
          </span>
          <span>{{ t.label }}</span>
        </div>
      }

      <div
        class="flex items-center gap-2 h-8 px-1 rounded-md hover:bg-gray-50 cursor-pointer"
        (click)="toggleNone()"
      >
        <span class="box" [class.box--none]="noneSelected()">
          @if (noneSelected()) { ✓ }
        </span>
        <span>(없음)</span>
      </div>

      <p class="mt-2 px-1 text-[10px] leading-tight text-tertiary">
        클릭: 진행중 → 완료 → 해제
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
    .box--active { background: #ffedd5; border-color: #c2410c; color: #c2410c; }
    .box--done   { background: #f3f4f6; border-color: #4b5563; color: #4b5563; }
    .box--none   { background: #1f2937; border-color: #1f2937; color: #ffffff; }
  `],
})
export class TrainingFilterComponent implements IFilterAngularComp {
  readonly trainings = TRAININGS;

  private params!: IFilterParams;
  private none = false;
  private states = new Map<string, TrainingStatus>();

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
    for (const [name, status] of this.states) {
      if (trainings.some(t => t.name === name && t.status === status)) return true;
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

  stateOf(name: string): TrainingStatus | undefined {
    return this.states.get(name);
  }

  toggleNone(): void {
    this.none = !this.none;
    this.params.filterChangedCallback();
  }

  /** off → IN_PROGRESS → COMPLETED → off */
  cycle(name: string): void {
    const current = this.states.get(name);
    if (!current) this.states.set(name, 'IN_PROGRESS');
    else if (current === 'IN_PROGRESS') this.states.set(name, 'COMPLETED');
    else this.states.delete(name);
    this.params.filterChangedCallback();
  }
}
