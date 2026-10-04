import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { injectAppLang } from '../../core/i18n/language';
import { trainingLabel } from '../../core/models/member-activity.model';
import { BreakpointService } from '../../core/ui/breakpoint.service';
import { DataTableComponent } from '../../core/ui/data-table/data-table.component';
import { DataColumn, DataRecord } from '../../core/ui/data-record.model';
import { EmptyStateComponent } from '../../core/ui/empty-state/empty-state.component';
import { ListCardComponent } from '../../core/ui/list-card/list-card.component';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../core/ui/section-header/section-header.component';
import { SegmentedControlComponent, SegmentOption } from '../../core/ui/segmented-control/segmented-control.component';
import { SkeletonComponent } from '../../core/ui/skeleton/skeleton.component';
import { ArchiveService, MinistryArchive, TrainingArchive } from './archive.service';

export type ArchiveTab = 'training' | 'ministry';

/** One card on the page: a heading and its rows. */
export interface ArchiveSection {
  id: string;
  heading: string;
  records: DataRecord[];
}

/**
 * 기록 (#31) — Figma: 양육 741:39767, 사역 741:41125.
 *
 * Read-only history in two tabs. 양육: one card per course with everyone who
 * completed it. 사역: one card per ministry with its former members. Cards
 * without rows are left out; a tab without any card shows an empty state.
 */
@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent, EmptyStateComponent, ListCardComponent, PageHeaderComponent,
    SectionHeaderComponent, SegmentedControlComponent, SkeletonComponent,
  ],
  templateUrl: './archive.component.html',
})
export class ArchiveComponent implements OnInit {
  private readonly service = inject(ArchiveService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly appLang = injectAppLang();

  /** Recomputes the translated labels when the language changes. */
  private readonly lang = toSignal(this.translate.onLangChange);

  readonly isPhone = inject(BreakpointService).isPhone;

  readonly tab = signal<string>('training');
  readonly loading = signal(true);
  readonly failed = signal(false);

  private readonly trainings = signal<TrainingArchive[]>([]);
  private readonly ministries = signal<MinistryArchive[]>([]);

  readonly tabOptions = computed<SegmentOption[]>(() => {
    this.lang();
    return [
      { value: 'training', label: this.translate.instant('archive.tabs.training') as string },
      { value: 'ministry', label: this.translate.instant('archive.tabs.ministry') as string },
    ];
  });

  readonly trainingColumns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`archive.columns.${key}`) as string;
    return [
      { type: 'avatar-name', header: t('name') },
      { type: 'text', header: t('group') },
      // Figma 741:39767: 상태 is muted text here, not a badge (#134).
      { type: 'text', key: 'status', header: t('status'), tone: 'muted', width: '160px' },
    ];
  });

  readonly ministryColumns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`archive.columns.${key}`) as string;
    return [
      { type: 'avatar-name', header: t('name') },
      { type: 'text', header: t('role') },
      { type: 'date', header: t('startDate') },
      { type: 'date', key: 'endDate', header: t('endDate') },
    ];
  });

  readonly trainingSections = computed<ArchiveSection[]>(() => {
    this.lang();
    const lang = this.appLang();
    const active = this.translate.instant('archive.status.active') as string;
    const graduated = this.translate.instant('archive.status.graduated') as string;
    return this.trainings()
      .filter(t => t.members.length > 0)
      .map(({ entry, members }) => ({
        id: entry.code,
        heading: this.translate.instant('archive.trainingHeading', {
          name: trainingLabel(entry, lang), count: members.length,
        }) as string,
        records: members.map(m => {
          const status = m.memberStatus === 'ACTIVE' ? active : graduated;
          return {
            id: m.publicId,
            title: m.lastName + m.firstName,
            subtitle: m.groupName ?? '—',
            // Figma 781:91274: the Phone card reads `1순 · 활동`, or just the status.
            cells: { status, phoneSubtitle: m.groupName ? `${m.groupName} · ${status}` : status },
          };
        }),
      }));
  });

  readonly ministrySections = computed<ArchiveSection[]>(() => {
    this.lang();
    return this.ministries()
      .filter(m => m.members.length > 0)
      .map(({ ministry, members }) => ({
        id: ministry.publicId,
        heading: this.translate.instant('archive.ministryHeading', {
          name: ministry.title, count: members.length,
        }) as string,
        // A member who served twice has two rows, so the id is the assignment.
        records: members.map(m => ({
          id: `${m.publicId}-${m.startDate}`,
          title: m.fullName,
          subtitle: m.role ? this.translate.instant(`ministry.detail.roles.${m.role}`) as string : '—',
          meta: formatYearMonth(m.startDate),
          cells: { endDate: formatYearMonth(m.endDate ?? null) },
        })),
      }));
  });

  readonly sections = computed(() =>
    this.tab() === 'ministry' ? this.ministrySections() : this.trainingSections());

  readonly columns = computed(() =>
    this.tab() === 'ministry' ? this.ministryColumns() : this.trainingColumns());

  ngOnInit(): void {
    let pending = 2;
    const done = () => { if (--pending === 0) this.loading.set(false); };
    const fail = () => { this.failed.set(true); done(); };

    this.service.loadTrainingArchive()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: t => { this.trainings.set(t); done(); }, error: fail });
    this.service.loadMinistryArchive()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: m => { this.ministries.set(m); done(); }, error: fail });
  }

  /**
   * The ListCard on Phone (Figma 781:91274). 양육: `1순 · 활동` as subtitle and
   * nothing on the right. 사역: the role and `23.03 – 25.12` as meta.
   */
  phoneRecord(record: DataRecord): DataRecord {
    const { id, title } = record;
    return this.tab() === 'ministry'
      ? { id, title, subtitle: record.subtitle, meta: `${record.meta} – ${record.cells?.['endDate'] ?? '—'}` }
      : { id, title, subtitle: String(record.cells?.['phoneSubtitle'] ?? '—') };
  }
}

/** `YYYY-MM-DD` → `YY.MM`, as in the Figma table. */
export function formatYearMonth(date: string | null): string {
  if (!date) return '—';
  const [year, month] = date.split('-');
  return `${year.slice(2)}.${month}`;
}
