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
import { DataColumn, DataRecord } from '../../../core/ui/data-record.model';
import { DataTableComponent } from '../../../core/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { ListCardComponent } from '../../../core/ui/list-card/list-card.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { StatCardComponent } from '../../../core/ui/stat-card/stat-card.component';
import { DIVISION_LABELS } from '../../attendance/attendance.model';
import { formatCheckInTime } from '../event-rsvp-format';
import { EventRsvpAttendee, EventRsvpAttendeesResponse } from '../event-rsvp.model';
import { EventRsvpService } from '../event-rsvp.service';

/** "다니엘 1순" — the 순 as it was when the member checked in. */
export function attendeeGroupLabel(attendee: Pick<EventRsvpAttendee, 'groupName' | 'groupDivision'>): string {
  if (!attendee.groupName) return '';
  const division = attendee.groupDivision
    ? DIVISION_LABELS[attendee.groupDivision] ?? attendee.groupDivision
    : '';
  return division ? `${division} ${attendee.groupName}` : attendee.groupName;
}

export interface GroupBreakdown {
  /** Distinct 순 among the attendees. */
  total: number;
  /** "다니엘 4 · 느헤미야 4" — distinct 순 per 부서, in first-seen order. */
  byDivision: string;
}

export function groupBreakdown(attendees: EventRsvpAttendee[]): GroupBreakdown {
  const groups = new Map<string, Set<string>>();
  for (const a of attendees) {
    if (!a.groupName) continue;
    const division = a.groupDivision ? DIVISION_LABELS[a.groupDivision] ?? a.groupDivision : '';
    const set = groups.get(division) ?? new Set<string>();
    set.add(a.groupName);
    groups.set(division, set);
  }
  const total = [...groups.values()].reduce((sum, s) => sum + s.size, 0);
  const byDivision = [...groups.entries()]
    .filter(([division]) => division)
    .map(([division, set]) => `${division} ${set.size}`)
    .join(' · ');
  return { total, byDivision };
}

/**
 * Figma: 이벤트 참석자 · Desktop (220:11145). Check-in order, with the 순 the
 * member belonged to when they checked in, and a link to the 이벤트 공지.
 */
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
  readonly result = signal<EventRsvpAttendeesResponse | null>(null);
  readonly loading = signal(false);
  readonly linkedAnnouncement = signal<{ id: string; title: string } | null>(null);

  readonly title = computed(() => this.result()?.eventTitle ?? '');
  readonly totalCount = computed(() => this.result()?.totalCount ?? 0);
  readonly groups = computed(() => groupBreakdown(this.result()?.attendees ?? []));

  readonly columns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`events.attendeeColumns.${key}`) as string;
    return [
      { type: 'text', key: 'order', header: t('order'), width: '64px', sortKey: 'cells.order' },
      { type: 'avatar-name', header: t('name') },
      { type: 'text', key: 'group', header: t('group') },
      { type: 'date', header: t('checkedInAt'), sortKey: 'cells.checkedInAt' },
    ];
  });

  readonly records = computed<DataRecord[]>(() => {
    const lang = this.lang();
    return (this.result()?.attendees ?? []).map((a, i) => {
      const group = attendeeGroupLabel(a);
      const time = formatCheckInTime(a.checkedInAt, lang);
      return {
        id: `${i + 1}`,
        title: a.memberName,
        initials: a.memberName.slice(-2),
        subtitle: group ? `${group} · ${time}` : time,
        meta: time,
        cells: { order: i + 1, group, checkedInAt: a.checkedInAt },
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
    this.service.getAttendees(this.eventPublicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
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
