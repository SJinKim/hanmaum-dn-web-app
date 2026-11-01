import { Component, computed, effect, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { LONG_ABSENCE_MEMO_MAX, LongAbsence } from '../../../core/models/long-absent.model';
import { memoLength } from './long-absent-format';

/**
 * Memo bearbeiten (#277, Figma 1959:178678 / 1959:181508). Opens with the
 * current memo; an empty or blank memo clears it on purpose (`null`). The limit
 * counts UTF-16 code units like the server and is shown, never cut silently —
 * so the textarea has no `maxlength`, which would truncate a paste.
 */
@Component({
  selector: 'app-long-absent-memo-dialog',
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
        <span class="flex flex-col gap-[var(--space-4)]">
          <h2 class="type-h3 text-ink-strong">{{ 'statistics.longAbsent.memoDialog.title' | translate }}</h2>
          <span class="type-body-sm text-ink-muted break-all">{{ row()?.fullName }}</span>
        </span>
      </ng-template>

      <div class="flex flex-col gap-[var(--space-8)]">
        @if (conflict()) {
          <div
            class="bg-[var(--color-badge-pending-bg)] text-[var(--color-badge-pending-fg)] type-body-sm flex gap-[var(--space-8)] rounded-[var(--radius-md)] p-[var(--space-12)]"
            role="alert"
            data-testid="memo-conflict">
            <i class="pi pi-exclamation-triangle mt-[2px]" aria-hidden="true"></i>
            <span>{{ 'statistics.longAbsent.conflictDialog.message' | translate }}</span>
          </div>
        }
        <label for="long-absent-memo" class="type-caption text-ink-muted">
          {{ 'statistics.longAbsent.memoDialog.label' | translate }}
        </label>
        <textarea
          id="long-absent-memo"
          pTextarea
          rows="6"
          class="w-full"
          data-testid="memo-input"
          [readonly]="conflict()"
          [formControl]="memo"
          [attr.aria-invalid]="tooLong()"
          aria-describedby="long-absent-memo-hint long-absent-memo-count"></textarea>
        <div class="flex items-start justify-between gap-[var(--space-12)]">
          <p id="long-absent-memo-hint" class="type-caption text-ink-muted">
            {{ 'statistics.longAbsent.memoDialog.privacy' | translate }}
          </p>
          <span
            id="long-absent-memo-count"
            class="type-caption shrink-0 tabular-nums"
            [class.text-ink-muted]="!tooLong()"
            [class.text-[var(--color-badge-deleted-fg)]]="tooLong()"
            data-testid="memo-count">
            {{ length() }} / {{ max }}
          </span>
        </div>
        @if (tooLong()) {
          <small class="type-caption text-[var(--color-badge-deleted-fg)]" role="alert" data-testid="memo-too-long">
            {{ 'statistics.longAbsent.memoDialog.tooLong' | translate: { max } }}
          </small>
        }
      </div>

      <ng-template #footer>
        <p-button
          [label]="(conflict() ? 'statistics.longAbsent.dialog.close' : 'statistics.longAbsent.dialog.cancel') | translate"
          severity="secondary"
          [outlined]="true"
          [disabled]="saving()"
          (onClick)="dismiss.emit()" />
        @if (!conflict()) {
          <p-button
            [label]="'statistics.longAbsent.dialog.save' | translate"
            [loading]="saving()"
            [disabled]="!canSave()"
            data-testid="memo-save"
            (onClick)="submit()" />
        }
      </ng-template>
    </p-dialog>
  `,
})
export class LongAbsentMemoDialogComponent {
  /** The row being edited; `null` closes the dialog. */
  readonly row = input<LongAbsence | null>(null);
  readonly saving = input(false);
  /**
   * 409 (#279 AK 5): the phase or version moved on. The draft stays visible and
   * copyable but can no longer be saved — it never goes into a newer phase.
   */
  readonly conflict = input(false);
  /** The memo to store, `null` to clear it. */
  readonly save = output<string | null>();
  readonly dismiss = output<void>();

  readonly max = LONG_ABSENCE_MEMO_MAX;
  readonly memo = new FormControl('', { nonNullable: true, validators: Validators.maxLength(LONG_ABSENCE_MEMO_MAX) });

  private readonly value = toSignal(this.memo.valueChanges, { initialValue: '' });
  readonly length = computed(() => memoLength(this.value()));
  readonly tooLong = computed(() => this.length() > LONG_ABSENCE_MEMO_MAX);
  readonly canSave = computed(() => !this.conflict() && !this.saving() && !this.tooLong() && this.value() !== (this.row()?.memo ?? ''));

  constructor() {
    // A new row starts from its own memo; the draft of the previous one is gone.
    effect(() => this.memo.setValue(this.row()?.memo ?? ''));
  }

  submit(): void {
    if (!this.canSave()) return;
    const value = this.memo.value;
    this.save.emit(value.trim() === '' ? null : value);
  }
}
