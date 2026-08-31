import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { TranslateService } from '@ngx-translate/core';

import { MemberService } from '../member.service';
import { TrainingCatalogService } from '../../../core/services/training-catalog.service';
import {
  Member,
  MemberStatus,
  GENDER_LABELS,
  BAPTISM_LABELS,
} from '../../../core/models/member.model';
import {
  UserTraining,
  MinistryHistory,
  monthYearFromCompletedAt,
} from '../../../core/models/member-activity.model';
import { trainingLabelForName } from '../../../core/models/member-activity.model';
import { injectAppLang } from '../../../core/i18n/language';
import { formatForDisplay } from '../../../core/models/phone.util';

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [
    ButtonModule,
    ConfirmDialogModule,
    ToastModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './member-detail.component.html',
})
export class MemberDetailComponent implements OnInit {
  private readonly memberService  = inject(MemberService);
  private readonly route          = inject(ActivatedRoute);
  private readonly router         = inject(Router);
  private readonly confirmService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef     = inject(DestroyRef);
  private readonly trainingCatalog = inject(TrainingCatalogService);
  private readonly translate      = inject(TranslateService);
  private readonly lang           = injectAppLang();

  member  = signal<Member | null>(null);
  loading = signal(true);

  readonly formatPhone = formatForDisplay;

  trainings(): UserTraining[]    { return this.member()?.trainings ?? []; }
  ministries(): MinistryHistory[] { return this.member()?.ministries ?? []; }

  ngOnInit(): void {
    // Course names are resolved through the catalog, so make sure it is loaded.
    this.trainingCatalog.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    const publicId = this.route.snapshot.paramMap.get('publicId')!;
    this.memberService.getMember(publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  m   => { this.member.set(m); this.loading.set(false); },
        error: ()  => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: '회원 정보를 불러올 수 없습니다.' });
          this.loading.set(false);
        },
      });
  }

  goToEdit(): void {
    this.router.navigate(['/members', this.member()!.publicId, 'edit']);
  }

  goBack(): void {
    this.router.navigate(['/members']);
  }

  confirmDelete(event: Event): void {
    this.confirmService.confirm({
      target: event.target as EventTarget,
      message: '이 회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      header: '회원 삭제',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '삭제',
      rejectLabel: '취소',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.memberService.deleteMember(this.member()!.publicId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: '완료', detail: '삭제되었습니다.' });
              setTimeout(() => this.router.navigate(['/members']), 1000);
            },
            error: () => {
              this.messageService.add({ severity: 'error', summary: '오류', detail: '삭제에 실패했습니다.' });
            },
          });
      },
    });
  }

  genderLabel(g: string | null): string       { return g ? (GENDER_LABELS[g as keyof typeof GENDER_LABELS] ?? g) : '—'; }
  baptismLabel(b: string | null): string      { return b ? (BAPTISM_LABELS[b as keyof typeof BAPTISM_LABELS] ?? b) : '—'; }

  statusBadgeClass(status: MemberStatus): string {
    const map: Record<MemberStatus, string> = {
      ACTIVE:   'badge-active',
      INACTIVE: 'badge-inactive',
      PENDING:  'badge-pending',
      DELETED:  'badge-deleted',
    };
    return map[status] ?? '';
  }

  // --- Training / ministry display ---

  /** Course name from the catalog in the active language; the raw DTO name if unknown. */
  trainingName(t: UserTraining): string {
    return trainingLabelForName(this.trainingCatalog.entries(), t.name, this.lang());
  }

  /** Completed month/year as "MM/YY"; the status label for every other status. */
  trainingDate(t: UserTraining): string {
    const status = this.translate.instant(`members.trainingStatus.${t.status}`) as string;
    if (t.status !== 'COMPLETED' || !t.completedAt) return status;
    const { month, year } = monthYearFromCompletedAt(t.completedAt);
    return month && year ? this.mmYy(month, year) : status;
  }

  private mmYy(month: number, year: number): string {
    return `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`;
  }

  /** "MM/YY – MM/YY", or "MM/YY – 현재" when ongoing. */
  ministryRange(m: MinistryHistory): string {
    const s = monthYearFromCompletedAt(m.startDate);
    const start = s.month && s.year ? this.mmYy(s.month, s.year) : '—';
    if (!m.endDate) return `${start} – 현재`;
    const e = monthYearFromCompletedAt(m.endDate);
    const end = e.month && e.year ? this.mmYy(e.month, e.year) : '—';
    return `${start} – ${end}`;
  }
}
