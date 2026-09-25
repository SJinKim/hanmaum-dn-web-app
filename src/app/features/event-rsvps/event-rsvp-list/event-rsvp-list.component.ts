import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { injectAppLang } from '../../../core/i18n/language';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { DataColumn, DataRecord } from '../../../core/ui/data-record.model';
import { DataCellDirective } from '../../../core/ui/data-table/data-cell.directive';
import { DataTableComponent } from '../../../core/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { ListCardComponent } from '../../../core/ui/list-card/list-card.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { StatCardComponent } from '../../../core/ui/stat-card/stat-card.component';
import { BadgeVariant } from '../../../core/ui/variant-tokens';
import { formatEventDate } from '../event-rsvp-format';
import { EventRsvpDto, EventRsvpStatus, eventRsvpStatus } from '../event-rsvp.model';
import { EventRsvpService } from '../event-rsvp.service';
import { EventRsvpDialogComponent } from './event-rsvp-dialog.component';

/** Figma: 접수 중 green, 예정 violet, 종료 gray, 비활성 amber. */
export const STATUS_BADGE: Record<EventRsvpStatus, BadgeVariant> = {
  OPEN: 'active',
  SCHEDULED: 'pending',
  CLOSED: 'neutral',
  INACTIVE: 'inactive',
};

export interface EventRsvpStats {
  total: number;
  open: number;
  scheduled: number;
  /** 종료 and 비활성 share a card. */
  closed: number;
}

export function eventRsvpStats(rsvps: EventRsvpDto[], now = new Date()): EventRsvpStats {
  const stats: EventRsvpStats = { total: rsvps.length, open: 0, scheduled: 0, closed: 0 };
  for (const r of rsvps) {
    const status = eventRsvpStatus(r, now);
    if (status === 'OPEN') stats.open++;
    else if (status === 'SCHEDULED') stats.scheduled++;
    else stats.closed++;
  }
  return stats;
}

/**
 * Figma: 이벤트 · Desktop (220:8818). Four stat cards over 이벤트 목록; each
 * row opens 참석자 (users icon) or the 수정 dialog (pencil). Events are not
 * deleted — 바로 공개 in the dialog takes one off the app.
 */
@Component({
  selector: 'app-event-rsvp-list',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    ToastModule,
    TooltipModule,
    DataCellDirective,
    DataTableComponent,
    EmptyStateComponent,
    ListCardComponent,
    PageHeaderComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    StatCardComponent,
    EventRsvpDialogComponent,
  ],
  providers: [MessageService],
  templateUrl: './event-rsvp-list.component.html',
})
export class EventRsvpListComponent implements OnInit {
  private readonly service        = inject(EventRsvpService);
  private readonly router         = inject(Router);
  private readonly translate      = inject(TranslateService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef     = inject(DestroyRef);
  private readonly lang           = injectAppLang();

  readonly isPhone = inject(BreakpointService).isPhone;

  readonly rsvps   = signal<EventRsvpDto[]>([]);
  readonly loading = signal(true);

  readonly dialogVisible = signal(false);
  readonly editing       = signal<EventRsvpDto | null>(null);

  /** Newest 접수 시작 first. */
  private readonly sorted = computed(() =>
    [...this.rsvps()].sort((a, b) => b.windowStart.localeCompare(a.windowStart)));

  readonly stats = computed(() => eventRsvpStats(this.rsvps()));

  readonly columns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`events.columns.${key}`) as string;
    return [
      { type: 'text', key: 'title', header: t('title'), tone: 'strong' },
      { type: 'date', key: 'start', header: t('windowStart'), sortKey: 'cells.startIso' },
      { type: 'date', key: 'end', header: t('windowEnd'), sortKey: 'cells.endIso' },
      { type: 'badge', header: t('status') },
      { type: 'custom', key: 'actions', header: t('actions'), width: '120px' },
    ];
  });

  readonly records = computed<DataRecord[]>(() => {
    const lang = this.lang();
    return this.sorted().map(r => {
      const start = formatEventDate(r.windowStart, lang);
      const end = formatEventDate(r.windowEnd, lang);
      const status = eventRsvpStatus(r);
      return {
        id: r.publicId,
        title: r.title,
        subtitle: `${start} – ${end}`,
        badge: {
          variant: STATUS_BADGE[status],
          label: this.translate.instant(`events.status.${status}`) as string,
        },
        cells: { title: r.title, start, end, startIso: r.windowStart, endIso: r.windowEnd },
      };
    });
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.getRsvps().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rsvps => {
        this.rsvps.set(rsvps);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toastError('events.errors.load');
      },
    });
  }

  openAdd(): void {
    this.editing.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(publicId: string): void {
    this.editing.set(this.rsvps().find(r => r.publicId === publicId) ?? null);
    this.dialogVisible.set(true);
  }

  openAttendees(publicId: string): void {
    void this.router.navigate(['/event-rsvps', publicId, 'attendees']);
  }

  onSaved(): void {
    this.messageService.add({ severity: 'success', summary: this.translate.instant('events.saved') as string });
    this.load();
  }

  onSaveFailed(): void {
    this.toastError('events.errors.save');
  }

  private toastError(key: string): void {
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('events.errors.summary') as string,
      detail: this.translate.instant(key) as string,
    });
  }
}
