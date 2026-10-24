import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';

import { injectAppLang } from '../../../core/i18n/language';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { DataColumn, DataRecord, DataRecordBadge } from '../../../core/ui/data-record.model';
import { DataTableComponent } from '../../../core/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { FilterChipComponent } from '../../../core/ui/filter-chip/filter-chip.component';
import { ListCardComponent } from '../../../core/ui/list-card/list-card.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { StatCardComponent } from '../../../core/ui/stat-card/stat-card.component';
import { DIVISION_LABELS } from '../../attendance/attendance.model';
import { formatCheckInTime } from '../event-rsvp-format';
import { EventMemberResponse, EventResponses, EventResponseStatus } from '../event-rsvp.model';
import { EventRsvpService } from '../event-rsvp.service';

/** Response-time group for an answer; current group for an unanswered member. */
export function attendeeGroupLabel(attendee: Pick<EventMemberResponse, 'groupName' | 'groupDivision'>): string {
  if (!attendee.groupName) return '';
  const division = attendee.groupDivision
    ? DIVISION_LABELS[attendee.groupDivision] ?? attendee.groupDivision
    : '';
  return division ? `${division} ${attendee.groupName}` : attendee.groupName;
}

type ResponseFilter = EventResponseStatus | 'PENDING' | 'ALL';
const RESPONSE_VARIANTS: Record<Exclude<ResponseFilter, 'ALL'>, DataRecordBadge['variant']> = {
  GOING: 'active', NOT_GOING: 'deleted', MAYBE: 'inactive', PENDING: 'neutral',
};

/** Figma: 이벤트 응답 현황, with explicit answers separate from unanswered members. */
@Component({
  selector: 'app-event-rsvp-attendees',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    ToastModule,
    DataTableComponent,
    EmptyStateComponent,
    ListCardComponent,
    FilterChipComponent,
    PageHeaderComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    StatCardComponent,
  ],
  providers: [MessageService],
  templateUrl: './event-rsvp-attendees.component.html',
})
export class EventRsvpAttendeesComponent implements OnInit {
  private readonly service        = inject(EventRsvpService);
  private readonly route          = inject(ActivatedRoute);
  private readonly router         = inject(Router);
  private readonly translate      = inject(TranslateService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef     = inject(DestroyRef);
  private readonly lang           = injectAppLang();

  readonly isPhone = inject(BreakpointService).isPhone;

  readonly eventPublicId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly result = signal<EventResponses | null>(null);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly responseFilter = signal<ResponseFilter>('ALL');
  readonly linkedAnnouncement = signal<{ id: string; title: string } | null>(null);

  readonly title = computed(() => this.result()?.eventTitle ?? '');
  readonly filters = computed(() => {
    this.lang();
    const result = this.result();
    return [
      { value: 'ALL', count: result?.expectedCount ?? 0 },
      { value: 'GOING', count: result?.goingCount ?? 0 },
      { value: 'NOT_GOING', count: result?.notGoingCount ?? 0 },
      { value: 'MAYBE', count: result?.maybeCount ?? 0 },
      { value: 'PENDING', count: result?.pendingCount ?? 0 },
    ].map(filter => ({ ...filter, value: filter.value as ResponseFilter,
      label: this.translate.instant(`events.responseStatus.${filter.value}`) as string }));
  });
  readonly summary = computed(() => {
    this.lang();
    const result = this.result();
    return this.translate.instant('events.responseSummary', {
      responded: result?.respondedCount ?? 0, expected: result?.expectedCount ?? 0,
    }) as string;
  });

  readonly columns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`events.attendeeColumns.${key}`) as string;
    return [
      { type: 'text', key: 'order', header: t('order'), width: '64px', sortKey: 'cells.order' },
      { type: 'avatar-name', header: t('name') },
      { type: 'text', key: 'group', header: t('group') },
      { type: 'badge', header: t('status') },
      { type: 'date', header: t('respondedAt'), sortKey: 'cells.respondedAt' },
    ];
  });

  readonly records = computed<DataRecord[]>(() => {
    const lang = this.lang();
    const filter = this.responseFilter();
    return (this.result()?.responses ?? [])
      .filter(a => filter === 'ALL' || (a.status ?? 'PENDING') === filter)
      .map((a, i) => {
        const status = a.status ?? 'PENDING';
        return {
          id: a.memberPublicId,
          title: a.memberName,
          initials: a.memberName.slice(-2),
          subtitle: attendeeGroupLabel(a),
          badge: { variant: RESPONSE_VARIANTS[status],
            label: this.translate.instant(`events.responseStatus.${status}`) as string },
          meta: a.respondedAt ? formatCheckInTime(a.respondedAt, lang) : '—',
          cells: { order: i + 1, group: attendeeGroupLabel(a), respondedAt: a.respondedAt ?? '' },
        };
      });
  });

  ngOnInit(): void {
    this.load();
    this.resolveLinkedAnnouncement();
  }

  load(): void {
    if (!this.eventPublicId) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.service.getResponses(this.eventPublicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('events.errors.summary') as string,
            detail: this.translate.instant('events.errors.attendees') as string,
          });
        },
      });
  }

  private resolveLinkedAnnouncement(): void {
    if (!this.eventPublicId) return;
    forkJoin({
      rsvps: this.service.getRsvps(),
      announcements: this.service.getEventAnnouncements(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ rsvps, announcements }) => {
          const id = rsvps.find(r => r.publicId === this.eventPublicId)?.announcementPublicId;
          const title = id ? announcements.find(a => a.id === id)?.title : undefined;
          this.linkedAnnouncement.set(id && title ? { id, title } : null);
        },
        error: () => this.linkedAnnouncement.set(null),
      });
  }

  goBack(): void {
    void this.router.navigate(['/event-rsvps']);
  }

  viewAnnouncement(): void {
    const announcement = this.linkedAnnouncement();
    if (!announcement) return;
    void this.router.navigate(['/announcements'], { queryParams: { focus: announcement.id } });
  }
}
