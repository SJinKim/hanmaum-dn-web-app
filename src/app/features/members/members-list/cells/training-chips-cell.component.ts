import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import {
  SummaryTraining,
  trainingLabelForName,
  trainingStatusGroup,
} from '../../../../core/models/member-activity.model';
import { TrainingCatalogService } from '../../../../core/services/training-catalog.service';
import { injectAppLang } from '../../../../core/i18n/language';

/**
 * Renders a member's trainings as chips, labelled from the training catalog in the
 * active language. The chip color follows the status group: orange while the member is
 * still working through the course, grey once completed, red once dropped.
 * Chips are ordered by training progression (as sent by the backend) and wrap in the cell.
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
          <span [class]="'status-badge ' + chipClass(t)">{{ label(t) }}</span>
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
  private readonly catalog = inject(TrainingCatalogService);
  private readonly lang    = injectAppLang();

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

  /** Korean or English course name from the catalog; the raw DTO name if unknown. */
  label(t: SummaryTraining): string {
    return trainingLabelForName(this.catalog.entries(), t.name, this.lang());
  }

  chipClass(t: SummaryTraining): string {
    switch (trainingStatusGroup(t.status)) {
      case 'ACTIVE':    return 'badge-training-progress';
      case 'COMPLETED': return 'badge-training-completed';
      default:          return 'badge-training-inactive';
    }
  }
}
