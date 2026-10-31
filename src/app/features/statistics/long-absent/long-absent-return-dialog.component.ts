import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { LongAbsence } from '../../../core/models/long-absent.model';

/**
 * 복귀 확인 (#279 AK 2, Figma 1990:183709 / 1990:184308). Confirmation only, no
 * memo (Jin, 30.10.). Says plainly that no check-in is recorded.
 */
@Component({
  selector: 'app-long-absent-return-dialog',
  standalone: true,
  imports: [TranslatePipe, ButtonModule, DialogModule],
  template: `
    <p-dialog
      [visible]="row() !== null"
      (visibleChange)="$event || dismiss.emit()"
      [modal]="true"
      [style]="{ width: 'min(92vw, 480px)' }"
      [draggable]="false"
      [resizable]="false"
      [closeOnEscape]="!saving()">
      <ng-template #header>
        <h2 class="type-h3 text-ink-strong">{{ 'statistics.longAbsent.returnDialog.title' | translate }}</h2>
      </ng-template>

      <div class="flex flex-col gap-[var(--space-8)]" data-testid="return-dialog">
        <p class="type-body text-ink break-words">
          {{ 'statistics.longAbsent.returnDialog.message' | translate: { name: row()?.fullName } }}
        </p>
        <p class="type-caption text-ink-muted">{{ 'statistics.longAbsent.returnDialog.hint' | translate }}</p>
      </div>

      <ng-template #footer>
        <p-button
          [label]="'statistics.longAbsent.dialog.cancel' | translate"
          severity="secondary"
          [outlined]="true"
          [disabled]="saving()"
          (onClick)="dismiss.emit()" />
        <p-button
          [label]="'statistics.longAbsent.returnDialog.confirm' | translate"
          [loading]="saving()"
          [disabled]="saving()"
          data-testid="return-confirm"
          (onClick)="saving() || confirm.emit()" />
      </ng-template>
    </p-dialog>
  `,
})
export class LongAbsentReturnDialogComponent {
  readonly row = input<LongAbsence | null>(null);
  readonly saving = input(false);
  readonly confirm = output<void>();
  readonly dismiss = output<void>();
}
