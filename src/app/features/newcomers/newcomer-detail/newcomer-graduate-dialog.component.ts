import { Component, DestroyRef, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { NewcomerService } from '../newcomer.service';
import { GraduateNewcomerRequest, NewcomerGraduation, NewcomerOption } from '../../../core/models/newcomer.model';
import { localDateToIso } from '../../../core/models/member-activity.model';

/** 등반차수 1..10, the same range the edit form offers for 등반차수. */
export const COHORT_NUMBERS: readonly number[] = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * Figma: 새가족 등반 · Dialog (327:22301). `POST /newcomers/{publicId}/graduate`
 * makes the newcomer a 청년 in the chosen 순. Toasts go through the host's
 * `MessageService`, so the detail page's `<p-toast>` shows them.
 */
@Component({
  selector: 'app-newcomer-graduate-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, DatePickerModule, DialogModule, InputTextModule, SelectModule, TranslatePipe],
  templateUrl: './newcomer-graduate-dialog.component.html',
})
export class NewcomerGraduateDialogComponent {
  private readonly newcomerService = inject(NewcomerService);
  private readonly fb              = inject(FormBuilder);
  private readonly messageService  = inject(MessageService);
  private readonly translate       = inject(TranslateService);
  private readonly destroyRef      = inject(DestroyRef);

  readonly visible     = model<boolean>(false);
  readonly publicId    = input.required<string>();
  readonly groups      = input<NewcomerOption[]>([]);
  /** Preselects 배정 순 with the group the newcomer is already assigned to. */
  readonly initialGroup = input<string | null>(null);
  readonly graduated   = output<NewcomerGraduation>();

  readonly dialogPt = { header: { style: { paddingBottom: 'var(--space-16)' } } };
  readonly saving = signal(false);

  readonly cohortOptions = COHORT_NUMBERS.map(n => ({ value: n, label: `${n}` }));

  readonly form = this.fb.group({
    cohortNumber: [null as number | null],
    graduatedAt:  [null as Date | null, Validators.required],
    groupId:      [null as string | null, Validators.required],
    note:         ['' as string | null],
  });

  cohortLabel(n: number): string {
    return this.translate.instant('newcomers.intakeRound', { n }) as string;
  }

  /** Called on open: 등반일 defaults to today, 배정 순 to the current assignment. */
  onShow(): void {
    const now = new Date();
    this.form.reset({
      cohortNumber: null,
      graduatedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      groupId: this.initialGroup(),
      note: '',
    });
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const body: GraduateNewcomerRequest = {
      groupPublicId: raw.groupId!,
      graduatedAt: localDateToIso(raw.graduatedAt) ?? undefined,
    };
    if (raw.cohortNumber) body.cohortNumber = raw.cohortNumber;
    if (raw.note?.trim()) body.assignmentReason = raw.note.trim();

    this.saving.set(true);
    this.newcomerService.graduate(this.publicId(), body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.saving.set(false);
          this.toast('success', 'newcomers.toast.done', 'newcomers.graduate.toast.done');
          this.graduated.emit(result);
          this.close();
        },
        error: () => {
          this.saving.set(false);
          this.toast('error', 'newcomers.toast.error', 'newcomers.graduate.toast.failed');
        },
      });
  }

  close(): void { this.visible.set(false); }

  private toast(severity: string, summary: string, detail: string): void {
    this.messageService.add({
      severity,
      summary: this.translate.instant(summary) as string,
      detail: this.translate.instant(detail) as string,
    });
  }
}
