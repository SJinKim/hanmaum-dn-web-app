import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { SummaryTraining } from '../../../../core/models/member-activity.model';

/**
 * Renders a member's trainings as chips: grey when COMPLETED, orange when IN_PROGRESS.
 * Chips are ordered by training progression (as sent by the backend) and wrap within the cell.
 */
@Component({
  selector: 'app-training-chips-cell',
  standalone: true,
  template: `
    @if (trainings.length === 0) {
      <span class="text-tertiary">—</span>
    } @else {
      <div class="chips">
        @for (t of trainings; track $index) {
          <span [class]="'status-badge ' + chipClass(t)">{{ t.name }}</span>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      height: 100%;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  `],
})
export class TrainingChipsCellComponent implements ICellRendererAngularComp {
  trainings: SummaryTraining[] = [];

  agInit(params: ICellRendererParams): void {
    this.update(params);
  }

  refresh(params: ICellRendererParams): boolean {
    this.update(params);
    return true;
  }

  private update(params: ICellRendererParams): void {
    this.trainings = (params.value as SummaryTraining[] | undefined) ?? [];
  }

  chipClass(t: SummaryTraining): string {
    return t.status === 'IN_PROGRESS' ? 'badge-training-progress' : 'badge-training-completed';
  }
}
