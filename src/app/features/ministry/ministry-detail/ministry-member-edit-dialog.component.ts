import { Component, DestroyRef, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

import { isoToLocalDate, localDateToIso } from '../../../core/models/member-activity.model';
import { MinistryAssignmentService } from '../ministry-assignment.service';
import { ActiveMinistryMemberDto } from '../ministry.model';

export const NOTE_MAX = 500;

/**
 * 관리 ✎ in 사역 상세 (Figma 728:35201). Saves 시작일, 종료일 and 메모 of one
 * assignment. A 종료일 ends it: the member leaves 팀원 and stays in 팀원 히스토리.
 */
@Component({
  selector: 'app-ministry-member-edit-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    ButtonModule, DatePickerModule, DialogModule, InputTextModule,
  ],
  templateUrl: './ministry-member-edit-dialog.component.html',
})
export class MinistryMemberEditDialogComponent {
  private readonly assignments = inject(MinistryAssignmentService);
  private readonly destroyRef  = inject(DestroyRef);

  /** Two-way: parent controls open/close via [(visible)]. */
  readonly visible = model(false);
  readonly ministryPublicId = input.required<string>();
  readonly member = input<ActiveMinistryMemberDto | null>(null);

  readonly saved  = output<void>();
  readonly failed = output<void>();

  readonly noteMax = NOTE_MAX;
  readonly saving  = signal(false);

  /** Figma Dialog/Medium: 24 panel padding, 16 between title, subtitle, form and footer. */
  readonly dialogPt = {
    header: { style: { paddingBottom: 'var(--space-16)' } },
  };

  readonly form = inject(FormBuilder).group({
    startDate: [null as Date | null, Validators.required],
    endDate:   [null as Date | null],
    note:      ['', Validators.maxLength(NOTE_MAX)],
  }, { validators: endNotBeforeStart });

  constructor() {
    effect(() => {
      const m = this.member();
      this.form.reset({
        startDate: isoToLocalDate(m?.startDate ?? null),
        endDate: isoToLocalDate(m?.endDate ?? null),
        note: m?.note ?? '',
      });
    });
  }

  endBeforeStart(): boolean { return this.form.hasError('endBeforeStart'); }

  hasError(control: 'startDate' | 'note', error: 'required' | 'maxlength'): boolean {
    const c = this.form.controls[control];
    return c.hasError(error) && (c.touched || c.dirty);
  }

  submit(): void {
    const m = this.member();
    if (!m) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const { startDate, endDate, note } = this.form.getRawValue();
    this.saving.set(true);
    this.assignments.updateAssignment(m.publicId, this.ministryPublicId(), {
      startDate: localDateToIso(startDate)!,
      endDate: localDateToIso(endDate),
      note: note?.trim() || null,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
          this.close();
        },
        error: () => {
          this.saving.set(false);
          this.failed.emit();
        },
      });
  }

  close(): void { this.visible.set(false); }
}

/** 종료일 is optional, but never before 시작일. */
function endNotBeforeStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as Date | null;
  const end = group.get('endDate')?.value as Date | null;
  return start && end && end < start ? { endBeforeStart: true } : null;
}
