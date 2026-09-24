import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { Menu, MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

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
  TrainingStatus,
} from '../../../core/models/member-activity.model';
import { trainingLabelForName } from '../../../core/models/member-activity.model';
import { injectAppLang } from '../../../core/i18n/language';
import { formatForDisplay } from '../../../core/models/phone.util';
import { BadgeVariant, resolveBadgeVariant } from '../../../core/ui/variant-tokens';
import { BadgeComponent } from '../../../core/ui/badge/badge.component';
import { DefinitionRowComponent } from '../../../core/ui/definition-list/definition-row.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';

/**
 * 양육 badge color per 상태: 신청/등록 grey, 진행 중 orange, 수료 green,
 * 중단/미확인 red (`deleted` is the red pair).
 */
const TRAINING_BADGE_VARIANTS: Record<TrainingStatus, BadgeVariant> = {
  APPLIED:     'neutral',
  ENROLLED:    'neutral',
  IN_PROGRESS: 'training-progress',
  COMPLETED:   'training-completed',
  DROPPED:     'deleted',
  UNKNOWN:     'deleted',
};

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [
    BadgeComponent,
    ButtonModule,
    ConfirmDialogModule,
    DefinitionRowComponent,
    EmptyStateComponent,
    MenuModule,
    PageHeaderComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    ToastModule,
    TranslatePipe,
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

  private readonly moreMenu = viewChild<Menu>('moreMenu');

  /** Full name as the list shows it, family name first. */
  readonly fullName = computed(() => {
    const m = this.member();
    return m ? `${m.lastName}${m.firstName}` : '';
  });

  readonly breadcrumb = computed(() => {
    this.lang();
    return [this.translate.instant('members.detail.breadcrumb') as string, this.fullName()];
  });

  /** "{순} · {등록일} 등록"; empty when neither is known. */
  readonly subtitle = computed(() => {
    this.lang();
    const m = this.member();
    if (!m || (!m.groupName && !m.registrationDate)) return '';
    return this.translate.instant('members.detail.subtitle', {
      group: m.groupName ?? '—',
      date: m.registrationDate ?? '—',
    }) as string;
  });

  /** "Straße Hausnummer, PLZ Ort", leaving out whatever is missing; `—` when all is. */
  readonly address = computed(() => {
    const m = this.member();
    if (!m) return '—';
    const line1 = [m.street, m.houseNumber].filter(Boolean).join(' ');
    const line2 = [m.zipCode, m.city].filter(Boolean).join(' ');
    return [line1, line2].filter(Boolean).join(', ') || '—';
  });

  readonly moreItems = computed<MenuItem[]>(() => {
    this.lang();
    return [{
      label: this.translate.instant('members.detail.delete') as string,
      icon: 'pi pi-trash',
      command: ({ originalEvent }) => this.confirmDelete(originalEvent as Event),
    }];
  });

  /**
   * 순장 row of the 교회 정보 card: the running tenure ("시작 ~ 현재"), else the last
   * ended one ("시작 ~ 종료", plus the 순 when it was another one). Null when the
   * member never led a group — the row is then left out.
   */
  readonly leaderRow = computed<{ label: string; value: string } | null>(() => {
    const m = this.member();
    if (!m) return null;
    if (m.isGroupLeader) {
      return { label: '순장', value: `${m.groupLeaderSince ?? '—'} ~ 현재` };
    }
    const past = m.lastGroupLeaderTenure;
    if (!past?.endDate) return null;
    const otherGroup = past.groupPublicId !== m.groupPublicId ? ` · ${past.groupName}` : '';
    return { label: '전 순장', value: `${past.startDate} ~ ${past.endDate}${otherGroup}` };
  });

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
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('members.toast.error'),
            detail: this.translate.instant('members.detail.toast.loadFailed'),
          });
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

  toggleMore(event: Event): void {
    this.moreMenu()?.toggle(event);
  }

  confirmDelete(event: Event): void {
    this.confirmService.confirm({
      target: event.target as EventTarget,
      message: this.translate.instant('members.detail.deleteDialog.message'),
      header: this.translate.instant('members.detail.deleteDialog.header'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('members.detail.deleteDialog.accept'),
      rejectLabel: this.translate.instant('members.detail.deleteDialog.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.memberService.deleteMember(this.member()!.publicId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: this.translate.instant('members.toast.done'),
                detail: this.translate.instant('members.detail.toast.deleted'),
              });
              setTimeout(() => this.router.navigate(['/members']), 1000);
            },
            error: () => {
              this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('members.toast.error'),
                detail: this.translate.instant('members.detail.toast.deleteFailed'),
              });
            },
          });
      },
    });
  }

  genderLabel(g: string | null): string       { return g ? (GENDER_LABELS[g as keyof typeof GENDER_LABELS] ?? g) : '—'; }
  baptismLabel(b: string | null): string      { return b ? (BAPTISM_LABELS[b as keyof typeof BAPTISM_LABELS] ?? b) : '—'; }

  statusVariant(status: MemberStatus): BadgeVariant { return resolveBadgeVariant(status.toLowerCase()); }
  statusLabel(status: MemberStatus): string {
    return this.translate.instant(`members.status.${status}`) as string;
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

  /** Badge above the training rows: "{과정} {상태}", colored by 상태 alone. */
  trainingBadge(t: UserTraining): { label: string; variant: BadgeVariant } {
    const status = this.translate.instant(`members.trainingStatus.${t.status}`) as string;
    return { label: `${this.trainingName(t)} ${status}`, variant: TRAINING_BADGE_VARIANTS[t.status] ?? 'deleted' };
  }

  /** Ministries still running — the badge row above the history. */
  activeMinistries(): MinistryHistory[] { return this.ministries().filter(m => !m.endDate); }

  /** "MM/YY – MM/YY", plus the note when there is one. */
  ministryValue(m: MinistryHistory): string {
    return m.note ? `${this.ministryRange(m)} · ${m.note}` : this.ministryRange(m);
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
