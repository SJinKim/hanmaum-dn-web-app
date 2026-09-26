import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';

import { localDateToIso } from '../../../core/models/member-activity.model';
import { injectAppLang } from '../../../core/i18n/language';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { DataColumn, DataRecord } from '../../../core/ui/data-record.model';
import { DataTableComponent } from '../../../core/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { FilterChipComponent } from '../../../core/ui/filter-chip/filter-chip.component';
import { ListCardComponent } from '../../../core/ui/list-card/list-card.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { AttendanceService } from '../attendance.service';
import {
  AttendanceGroupCountsResponse,
  ChurchGroupAttendanceCountResponse,
  DIVISION_LABELS,
  DayOfWeek,
  DefinitionDto,
} from '../attendance.model';
import { AttendanceDefinitionDialogComponent } from './attendance-definition-dialog.component';

/** Sunday first, as `Date.getDay()` counts. */
const DAYS_BY_INDEX: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/**
 * Figma: 출석 · Desktop (210:6726), 기록 tab (211:6948). Tab 정의 lists the
 * 출석 정의 with 요일, 체크인 시간 and 상태; ✎ opens the dialog (279:18000),
 * 🗑 deactivates.
 *
 * Tab 기록 shows per 순 counts only. Figma lists people there, but until #224
 * decides who may see names, the web shows the aggregate `group-counts`.
 */
@Component({
  selector: 'app-attendance-definitions',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    ConfirmDialogModule,
    DatePickerModule,
    SelectModule,
    TabsModule,
    ToastModule,
    DataTableComponent,
    EmptyStateComponent,
    FilterChipComponent,
    ListCardComponent,
    PageHeaderComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    AttendanceDefinitionDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './attendance-definitions.component.html',
})
export class AttendanceDefinitionsComponent implements OnInit {
  private readonly service        = inject(AttendanceService);
  private readonly translate      = inject(TranslateService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef     = inject(DestroyRef);
  private readonly lang           = injectAppLang();

  readonly isPhone = inject(BreakpointService).isPhone;

  readonly definitions   = signal<DefinitionDto[]>([]);
  readonly loading       = signal(true);
  readonly countsLoading = signal(false);
  readonly groupCounts   = signal<AttendanceGroupCountsResponse | null>(null);
  readonly activeTab     = signal<number>(0);

  readonly dialogVisible = signal(false);
  readonly editing       = signal<DefinitionDto | null>(null);

  readonly selectedDefinitionId = signal('');
  readonly selectedDate         = signal<Date | null>(new Date());
  /** `null` is 전체; otherwise the chip's group key. */
  readonly selectedGroup        = signal<string | null>(null);

  /** "출석 정의 N개 · 활성 M개". */
  readonly subtitle = computed(() => {
    this.lang();
    const defs = this.definitions();
    return this.translate.instant('attendance.subtitle', {
      count: defs.length,
      active: defs.filter(d => d.isActive).length,
    }) as string;
  });

  readonly columns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`attendance.columns.${key}`) as string;
    return [
      { type: 'text', key: 'title', header: t('title'), tone: 'strong' },
      { type: 'text', key: 'day', header: t('day'), width: '140px' },
      { type: 'text', key: 'window', header: t('window'), width: '180px' },
      { type: 'badge', header: t('status') },
      { type: 'actions', header: t('actions') },
    ];
  });

  readonly records = computed<DataRecord[]>(() => {
    this.lang();
    return this.definitions().map(d => ({
      id: d.publicId,
      title: d.title,
      subtitle: `${this.dayLabel(d.dayOfWeek)} · ${this.windowLabel(d)}`,
      badge: this.statusBadge(d.isActive),
      cells: { title: d.title, day: this.dayLabel(d.dayOfWeek), window: this.windowLabel(d) },
    }));
  });

  readonly definitionOptions = computed(() =>
    this.definitions().map(d => ({ value: d.publicId, label: d.title })),
  );

  /** Groups by count, most first; ties by name. */
  readonly sortedGroups = computed(() => {
    this.lang();
    return [...(this.groupCounts()?.groups ?? [])].sort((a, b) =>
      b.attendanceCount - a.attendanceCount
      || this.groupDisplayName(a).localeCompare(this.groupDisplayName(b), 'ko'));
  });

  readonly visibleGroups = computed(() => {
    const selected = this.selectedGroup();
    return selected === null
      ? this.sortedGroups()
      : this.sortedGroups().filter(g => groupKey(g) === selected);
  });

  readonly groupColumns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`attendance.columns.${key}`) as string;
    return [
      { type: 'text', key: 'group', header: t('group'), tone: 'strong' },
      { type: 'text', key: 'count', header: t('count'), align: 'end', width: '120px', sortKey: 'cells.countValue' },
      { type: 'text', key: 'inPlace', header: t('inPlace'), align: 'end', width: '120px', sortKey: 'cells.inPlaceValue' },
      { type: 'text', key: 'outside', header: t('outside'), align: 'end', width: '120px', sortKey: 'cells.outsideValue' },
      { type: 'text', key: 'unconfirmed', header: t('unconfirmed'), align: 'end', width: '120px', sortKey: 'cells.unconfirmedValue' },
      { type: 'progress', key: 'share', header: t('share') },
    ];
  });

  readonly groupRecords = computed<DataRecord[]>(() => {
    this.lang();
    const total = this.groupCounts()?.totalCount ?? 0;
    return this.visibleGroups().map(g => {
      const name = this.groupDisplayName(g);
      const share = total === 0 ? 0 : Math.round((g.attendanceCount / total) * 100);
      const count = this.people(g.attendanceCount);
      const location = this.locationSummary(g.inPlaceCount, g.outsideCount, g.unconfirmedCount);
      return {
        id: groupKey(g),
        title: name,
        subtitle: location ? `${count} · ${location}` : count,
        meta: `${share}%`,
        cells: {
          group: name,
          count,
          countValue: g.attendanceCount,
          inPlace: this.people(g.inPlaceCount),
          inPlaceValue: g.inPlaceCount ?? -1,
          outside: this.people(g.outsideCount),
          outsideValue: g.outsideCount ?? -1,
          unconfirmed: this.people(g.unconfirmedCount),
          unconfirmedValue: g.unconfirmedCount ?? -1,
          share: { value: share, label: `${share}%` },
        },
      };
    });
  });

  /** 교회 안 · 교회 밖 · 미확인 totals below the table; null on servers before #35. */
  readonly locationTotals = computed<string | null>(() => {
    this.lang();
    const c = this.groupCounts();
    return c ? this.locationSummary(c.totalInPlaceCount, c.totalOutsideCount, c.totalUnconfirmedCount) : null;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.getDefinitions(false).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: defs => {
        this.definitions.set(defs);
        this.ensureSelectedDefinition(defs);
        this.loading.set(false);
        this.loadGroupCounts();
      },
      error: () => {
        this.loading.set(false);
        this.toastError('attendance.errors.load');
      },
    });
  }

  openAdd(): void {
    this.editing.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(publicId: string): void {
    this.editing.set(this.definitions().find(d => d.publicId === publicId) ?? null);
    this.dialogVisible.set(true);
  }

  onSaved(def: DefinitionDto): void {
    this.messageService.add({ severity: 'success', summary: this.translate.instant('attendance.saved') as string });
    if (!this.selectedDefinitionId()) this.selectedDefinitionId.set(def.publicId);
    this.load();
  }

  onSaveFailed(): void {
    this.toastError('attendance.errors.save');
  }

  confirmDeactivate(publicId: string): void {
    const def = this.definitions().find(d => d.publicId === publicId);
    if (!def) return;
    this.confirmService.confirm({
      header: this.translate.instant('attendance.deactivate.header') as string,
      message: this.translate.instant('attendance.deactivate.message', { title: def.title }) as string,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('attendance.deactivate.accept') as string,
      rejectLabel: this.translate.instant('attendance.dialog.cancel') as string,
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => this.deactivate(def),
    });
  }

  onDefinitionChange(publicId: string): void {
    this.selectedDefinitionId.set(publicId);
    this.loadGroupCounts();
  }

  onDateChange(date: Date | null): void {
    this.selectedDate.set(date);
    this.ensureSelectedDefinition(this.definitions(), true);
    this.loadGroupCounts();
  }

  selectGroup(key: string | null): void {
    this.selectedGroup.set(this.selectedGroup() === key ? null : key);
  }

  groupKey(group: ChurchGroupAttendanceCountResponse): string {
    return groupKey(group);
  }

  /** `n명`, or a dash when the server did not send the number. */
  private people(count: number | undefined): string {
    return count === undefined ? '–' : this.translate.instant('attendance.people', { count }) as string;
  }

  private locationSummary(inPlace?: number, outside?: number, unconfirmed?: number): string | null {
    if (inPlace === undefined && outside === undefined && unconfirmed === undefined) return null;
    const t = (key: string) => this.translate.instant(`attendance.columns.${key}`) as string;
    return [
      `${t('inPlace')} ${this.people(inPlace)}`,
      `${t('outside')} ${this.people(outside)}`,
      `${t('unconfirmed')} ${this.people(unconfirmed)}`,
    ].join(' · ');
  }

  groupDisplayName(group: ChurchGroupAttendanceCountResponse): string {
    if (!group.groupName) return this.translate.instant('attendance.noGroup') as string;
    return group.groupDivision
      ? `${DIVISION_LABELS[group.groupDivision.toUpperCase()] ?? group.groupDivision} · ${group.groupName}`
      : group.groupName;
  }

  loadGroupCounts(): void {
    const definitionId = this.selectedDefinitionId();
    const date = localDateToIso(this.selectedDate());
    this.selectedGroup.set(null);
    if (!definitionId || !date) {
      this.groupCounts.set(null);
      return;
    }

    this.countsLoading.set(true);
    this.service.getGroupCounts({ definitionId, date })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: counts => {
          this.groupCounts.set(counts);
          this.countsLoading.set(false);
        },
        error: () => {
          this.groupCounts.set(null);
          this.countsLoading.set(false);
          this.toastError('attendance.errors.counts');
        },
      });
  }

  private deactivate(def: DefinitionDto): void {
    this.service.deactivateDefinition(def.publicId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.load(),
      error: () => this.toastError('attendance.errors.deactivate'),
    });
  }

  private dayLabel(day: DayOfWeek): string {
    return this.translate.instant(`attendance.days.${day}`) as string;
  }

  /** "09:00 – 10:30". */
  private windowLabel(d: DefinitionDto): string {
    return `${d.windowStart.slice(0, 5)} – ${d.windowEnd.slice(0, 5)}`;
  }

  /** Figma: 활성 = active (green), 비활성 = pending (orange). */
  private statusBadge(active: boolean): DataRecord['badge'] {
    return active
      ? { variant: 'active', label: this.translate.instant('attendance.status.active') as string }
      : { variant: 'pending', label: this.translate.instant('attendance.status.inactive') as string };
  }

  /** Keeps the chosen definition, else takes an active one on the date's weekday. */
  private ensureSelectedDefinition(defs: DefinitionDto[], preferSelectedDate = false): void {
    const date = this.selectedDate();
    const day = date ? DAYS_BY_INDEX[date.getDay()] : null;
    const selected = defs.find(d => d.publicId === this.selectedDefinitionId());
    if (selected && (!preferSelectedDate || selected.dayOfWeek === day)) return;

    const fallback = (day
      ? defs.find(d => d.isActive && d.dayOfWeek === day) ?? defs.find(d => d.dayOfWeek === day)
      : undefined) ?? defs.find(d => d.isActive) ?? defs[0];
    this.selectedDefinitionId.set(fallback?.publicId ?? '');
  }

  private toastError(key: string): void {
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('attendance.errors.summary') as string,
      detail: this.translate.instant(key) as string,
    });
  }
}

/** Chip and row key; groups without a 순 share one. */
function groupKey(group: ChurchGroupAttendanceCountResponse): string {
  return group.groupPublicId ?? 'none';
}
