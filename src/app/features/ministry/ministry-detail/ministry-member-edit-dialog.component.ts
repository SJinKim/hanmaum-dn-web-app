import { Component, DestroyRef, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

import { isoToLocalDate, localDateToIso } from '../../../core/models/member-activity.model';
import { MinistryAssignmentService } from '../ministry-assignment.service';
import { ActiveMinistryMemberDto } from '../ministry.model';

export const NOTE_MAX = 500;

/**
 * 관리 ✎ in 사역 상세 (Figma 204:6930). Saves 시작일 and 메모 of one assignment.
 * 역할 and 상태 stay disabled until the API carries them (hanmaum-dn-server#214).
 */
@Component({
  selector: 'app-ministry-member-edit-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    ButtonModule, DatePickerModule, DialogModule, InputTextModule, SelectModule,
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

  readonly form = inject(FormBuilder).group({
    role:      [{ value: null as string | null, disabled: true }],
    status:    [{ value: null as string | null, disabled: true }],
    startDate: [null as Date | null, Validators.required],
    note:      ['', Validators.maxLength(NOTE_MAX)],
  });

  constructor() {
    effect(() => {
      const m = this.member();
      this.form.reset({ role: null, status: null, startDate: isoToLocalDate(m?.startDate ?? null), note: m?.note ?? '' });
    });
  }

  hasError(control: 'startDate' | 'note', error: 'required' | 'maxlength'): boolean {
    const c = this.form.controls[control];
    return c.hasError(error) && (c.touched || c.dirty);
  }

  submit(): void {
    const m = this.member();
    if (!m) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const { startDate, note } = this.form.getRawValue();
    this.saving.set(true);
    this.assignments.updateAssignment(m.publicId, this.ministryPublicId(), {
      startDate: localDateToIso(startDate)!,
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
