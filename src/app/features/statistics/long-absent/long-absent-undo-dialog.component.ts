import { Component, computed, effect, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { LONG_ABSENCE_MEMO_MAX, LongAbsence } from '../../../core/models/long-absent.model';
import { memoLength, memoWithAddition } from './long-absent-format';

/** Undo outcome: `null` keeps the memo as it is, a string replaces it. */
export interface LongAbsentUndo {
  readonly memo: string | null;
}

/**
 * Kontakt zurücknehmen (#277 AK 5, Figma 1959:180923 / 1959:181750). Asks for
 * optional new details. Without them the memo stays untouched; with them the
 * whole memo — existing text, line break, details — must fit the limit.
 */
@Component({
  selector: 'app-long-absent-undo-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ButtonModule, DialogModule, TextareaModule],
  template: `
    <p-dialog
      [visible]="row() !== null"
      (visibleChange)="$event || dismiss.emit()"
      [modal]="true"
      [style]="{ width: 'min(92vw, 560px)' }"
      [draggable]="false"
      [resizable]="false"
      [closeOnEscape]="!saving()">
      <ng-template #header>
        <h2 class="type-h3 text-ink-strong">{{ 'statistics.longAbsent.undoDialog.title' | translate }}</h2>
      </ng-template>

      <div class="flex flex-col gap-[var(--space-12)]">
        <p class="type-body text-ink break-words">
          {{ 'statistics.longAbsent.undoDialog.message' | translate: { name: row()?.fullName } }}
        </p>
        <div class="flex flex-col gap-[var(--space-8)]">
          <label for="long-absent-undo-details" class="type-caption text-ink-muted">
            {{ 'statistics.longAbsent.undoDialog.label' | translate }}
          </label>
          <textarea
            id="long-absent-undo-details"
            pTextarea
            rows="4"
            class="w-full"
            data-testid="undo-details"
            [formControl]="details"
            [attr.aria-invalid]="tooLong()"
            aria-describedby="long-absent-undo-hint long-absent-undo-count"></textarea>
          <div class="flex items-start justify-between gap-[var(--space-12)]">
            <p id="long-absent-undo-hint" class="type-caption text-ink-muted">
              {{ 'statistics.longAbsent.memoDialog.privacy' | translate }}
            </p>
            <span
              id="long-absent-undo-count"
              class="type-caption shrink-0 tabular-nums"
              [class.text-ink-muted]="!tooLong()"
              [class.text-[var(--color-badge-deleted-fg)]]="tooLong()"
              data-testid="undo-count">
              {{ total() }} / {{ max }}
            </span>
          </div>
          @if (tooLong()) {
            <small class="type-caption text-[var(--color-badge-deleted-fg)]" role="alert" data-testid="undo-too-long">
              {{ 'statistics.longAbsent.undoDialog.tooLong' | translate: { max } }}
            </small>
          }
        </div>
      </div>

      <ng-template #footer>
        <p-button
          [label]="'statistics.longAbsent.dialog.cancel' | translate"
          severity="secondary"
          [outlined]="true"
          [disabled]="saving()"
          (onClick)="dismiss.emit()" />
        <p-button
          [label]="'statistics.longAbsent.undoDialog.confirm' | translate"
          [loading]="saving()"
          [disabled]="saving() || tooLong()"
          data-testid="undo-confirm"
          (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
})
export class LongAbsentUndoDialogComponent {
  readonly row = input<LongAbsence | null>(null);
  readonly saving = input(false);
  readonly confirm = output<LongAbsentUndo>();
  readonly dismiss = output<void>();

  readonly max = LONG_ABSENCE_MEMO_MAX;
  readonly details = new FormControl('', { nonNullable: true });

  private readonly value = toSignal(this.details.valueChanges, { initialValue: '' });
  /** Length of the memo that would be stored — the current one when nothing is added. */
  readonly total = computed(() => {
    const existing = this.row()?.memo ?? null;
    return memoLength(memoWithAddition(existing, this.value()) ?? existing ?? '');
  });
  readonly tooLong = computed(() => this.total() > LONG_ABSENCE_MEMO_MAX);

  constructor() {
    effect(() => {
      this.row();
      this.details.setValue('');
    });
  }

  submit(): void {
    if (this.saving() || this.tooLong()) return;
    this.confirm.emit({ memo: memoWithAddition(this.row()?.memo ?? null, this.details.value) });
  }
}
