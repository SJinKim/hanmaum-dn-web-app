import {
  Component, DestroyRef, EventEmitter, OnInit, Output,
  inject, input, model, signal, computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MinistryService } from '../ministry.service';
import { MemberNameDto, ActiveMinistryMemberDto, AddMinistryMemberRequest } from '../ministry.model';
import { localDateToIso } from '../../../core/models/member-activity.model';

@Component({
  selector: 'app-ministry-add-member-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    DialogModule, ButtonModule, DatePickerModule, SelectModule, InputTextModule, ToastModule, TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './ministry-add-member-dialog.component.html',
})
export class MinistryAddMemberDialogComponent implements OnInit {
  private readonly ministryService = inject(MinistryService);
  private readonly fb              = inject(FormBuilder);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);
  private readonly translate       = inject(TranslateService);

  /** Two-way: parent controls open/close via [(visible)]. */
  readonly visible = model<boolean>(false);
  readonly ministryPublicId = input.required<string>();
  @Output() readonly added = new EventEmitter<ActiveMinistryMemberDto>();

  /** Figma Dialog/Medium: 24 panel padding, 16 between title, subtitle, form and footer. */
  readonly dialogPt = {
    header: { style: { paddingBottom: 'var(--space-16)' } },
  };

  readonly saving = signal(false);
  private readonly memberNames = signal<MemberNameDto[]>([]);
  readonly memberOptions = computed(() =>
    this.memberNames().map(m => ({ value: m.publicId, label: this.memberLabel(m) })));

  readonly form = this.fb.group({
    memberId:   [null as string | null, Validators.required],
    startDate:  [null as Date | null, Validators.required],
    note:       ['' as string | null],
  });

  constructor() {
    this.form.reset(this.defaultFormValue());
  }

  /** Pristine form values, with 시작일 defaulted to today (computed fresh each call). */
  private defaultFormValue(): { memberId: null; startDate: Date; note: string } {
    const now = new Date();
    return { memberId: null, startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()), note: '' };
  }

  ngOnInit(): void {
    this.ministryService.getMemberNames()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: names => this.memberNames.set(names),
        error: () => this.toast('error', 'error', 'namesFailed'),
      });
  }

  /** "김철수 A" when a discriminator distinguishes same-named 팀원, else "김철수". */
  memberLabel(dto: MemberNameDto): string {
    return dto.discriminator ? `${dto.fullName} ${dto.discriminator}` : dto.fullName;
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const body: AddMinistryMemberRequest = {
      memberId:  raw.memberId!,
      startDate: localDateToIso(raw.startDate),
      note:      raw.note?.trim() || null,
    };
    this.saving.set(true);
    this.ministryService.addMember(this.ministryPublicId(), body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: dto => {
          this.saving.set(false);
          this.added.emit(dto);
          this.toast('success', 'done', 'added');
          this.close();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          if (err.status === 409) {
            this.toast('info', 'info', 'conflict');
          } else {
            this.toast('error', 'error', 'failed');
          }
        },
      });
  }

  private toast(severity: string, summaryKey: string, detailKey: string): void {
    const t = (key: string) => this.translate.instant(`ministry.detail.addDialog.toast.${key}`) as string;
    this.messageService.add({ severity, summary: t(summaryKey), detail: t(detailKey) });
  }

  /** Single close path: clears the form and hides the dialog. */
  close(): void { this.onVisibleChange(false); }

  /**
   * Mirrors the dialog's open state into the model and resets the form on close,
   * so dismissing via the header X or backdrop clears it just like the 취소 button.
   */
  onVisibleChange(open: boolean): void {
    this.visible.set(open);
    if (!open) this.form.reset(this.defaultFormValue());
  }
}
