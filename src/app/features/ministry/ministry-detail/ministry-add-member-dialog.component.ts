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
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { MinistryService } from '../ministry.service';
import { MemberNameDto, ActiveMinistryMemberDto, AddMinistryMemberRequest } from '../ministry.model';
import { MONTH_OPTIONS, YEAR_OPTIONS, monthYearToFirstOfMonth } from '../../../core/models/member-activity.model';

@Component({
  selector: 'app-ministry-add-member-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    DialogModule, ButtonModule, SelectModule, InputTextModule, ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './ministry-add-member-dialog.component.html',
})
export class MinistryAddMemberDialogComponent implements OnInit {
  private readonly ministryService = inject(MinistryService);
  private readonly fb              = inject(FormBuilder);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);

  /** Two-way: parent controls open/close via [(visible)]. */
  readonly visible = model<boolean>(false);
  readonly ministryPublicId = input.required<string>();
  @Output() readonly added = new EventEmitter<ActiveMinistryMemberDto>();

  readonly saving = signal(false);
  private readonly memberNames = signal<MemberNameDto[]>([]);
  readonly memberOptions = computed(() =>
    this.memberNames().map(m => ({ value: m.publicId, label: this.memberLabel(m) })));

  readonly monthOptions = MONTH_OPTIONS;
  readonly yearOptions  = YEAR_OPTIONS;

  private readonly now = new Date();
  readonly form = this.fb.group({
    memberId:   [null as string | null, Validators.required],
    startYear:  [this.now.getFullYear() as number | null, Validators.required],
    startMonth: [(this.now.getMonth() + 1) as number | null, Validators.required],
    note:       ['' as string | null],
  });

  ngOnInit(): void {
    this.ministryService.getMemberNames()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: names => this.memberNames.set(names),
        error: () => this.messageService.add({
          severity: 'error', summary: '오류', detail: '맴버 목록을 불러올 수 없습니다.',
        }),
      });
  }

  /** "김철수 A" when a discriminator distinguishes same-named 맴버, else "김철수". */
  memberLabel(dto: MemberNameDto): string {
    return dto.discriminator ? `${dto.fullName} ${dto.discriminator}` : dto.fullName;
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const body: AddMinistryMemberRequest = {
      memberId:  raw.memberId!,
      startDate: monthYearToFirstOfMonth(raw.startMonth, raw.startYear),
      note:      raw.note?.trim() || null,
    };
    this.saving.set(true);
    this.ministryService.addMember(this.ministryPublicId(), body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: dto => {
          this.saving.set(false);
          this.added.emit(dto);
          this.messageService.add({ severity: 'success', summary: '완료', detail: '추가되었습니다.' });
          this.close();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          if (err.status === 409) {
            this.messageService.add({
              severity: 'info', summary: '알림',
              detail: err.error?.message ?? '이 맴버는 이미 활동중입니다.',
            });
          } else {
            this.messageService.add({ severity: 'error', summary: '오류', detail: '추가에 실패했습니다.' });
          }
        },
      });
  }

  close(): void {
    this.form.reset({
      memberId: null,
      startYear: this.now.getFullYear(),
      startMonth: this.now.getMonth() + 1,
      note: '',
    });
    this.visible.set(false);
  }
}
