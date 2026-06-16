import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AttendanceService } from '../attendance.service';
import {
  ATTENDANCE_COLUMN_LABELS,
  DIVISION_LABELS,
  AttendanceGroupCountsResponse,
  ChurchGroupAttendanceCountResponse,
  DAY_OF_WEEK_LABELS,
  DAY_OF_WEEK_OPTIONS,
  DayOfWeek,
  DefinitionDto,
} from '../attendance.model';

@Component({
  selector: 'app-attendance-definitions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CheckboxModule,
    TagModule,
    InputTextModule,
    SelectModule,
    MultiSelectModule,
    DatePickerModule,
    ProgressBarModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    TooltipModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './attendance-definitions.component.html',
})
export class AttendanceDefinitionsComponent implements OnInit {
  private readonly service      = inject(AttendanceService);
  private readonly router       = inject(Router);
  private readonly confirmSvc   = inject(ConfirmationService);
  private readonly messageSvc   = inject(MessageService);
  private readonly destroyRef   = inject(DestroyRef);

  definitions    = signal<DefinitionDto[]>([]);
  loading        = signal(false);
  countsLoading  = signal(false);
  groupCounts    = signal<AttendanceGroupCountsResponse | null>(null);
  showCreate     = signal(false);
  showEditDialog = false;

  // distribution table filter + sort state
  groupFilter = signal<string[]>([]);
  activeOnly  = signal(true);
  sortField   = signal<'attendanceCount' | 'share'>('attendanceCount');
  sortOrder   = signal<1 | -1>(-1);

  readonly dayOptions = DAY_OF_WEEK_OPTIONS;
  readonly columnLabels = ATTENDANCE_COLUMN_LABELS;

  selectedDefinitionId = '';
  selectedDate: Date | null = new Date();

  readonly selectedDefinition = computed(() =>
    this.definitions().find(def => def.publicId === this.selectedDefinitionId) ?? null,
  );

  readonly sortedGroups = computed(() => {
    const groups = this.groupCounts()?.groups ?? [];
    return [...groups].sort((a, b) => {
      if (b.attendanceCount !== a.attendanceCount) return b.attendanceCount - a.attendanceCount;
      return this.groupDisplayName(a).localeCompare(this.groupDisplayName(b), 'ko');
    });
  });

  readonly attendingGroupCount = computed(() =>
    this.sortedGroups().filter(group => group.attendanceCount > 0).length,
  );

  readonly activeGroupCount = computed(() => this.sortedGroups().length);

  // church-group options for the distribution filter (exact values)
  readonly groupFilterOptions = computed(() =>
    (this.groupCounts()?.groups ?? []).map(group => ({
      label: this.groupDisplayName(group),
      value: group.groupPublicId ?? '',
    })),
  );

  // rows actually rendered: filtered by selected groups, then sorted by the active column
  readonly displayedGroups = computed(() => {
    const groups = this.groupCounts()?.groups ?? [];
    const selected = this.groupFilter();
    let filtered = selected.length === 0
      ? groups
      : groups.filter(group => selected.includes(group.groupPublicId ?? ''));

    if (this.activeOnly()) {
      filtered = filtered.filter(group => group.attendanceCount > 0);
    }

    const order = this.sortOrder();
    return [...filtered].sort((a, b) => {
      // 비중 is monotonic with attendanceCount (total is constant), so both columns sort identically
      if (a.attendanceCount !== b.attendanceCount) return order * (a.attendanceCount - b.attendanceCount);
      return this.groupDisplayName(a).localeCompare(this.groupDisplayName(b), 'ko');
    });
  });

  // create form state
  createTitle       = '';
  createDayOfWeek: DayOfWeek | null = null;
  createWindowStart = '';
  createWindowEnd   = '';

  // edit form state
  editTarget: DefinitionDto | null = null;
  editTitle       = '';
  editDayOfWeek: DayOfWeek | null = null;
  editWindowStart = '';
  editWindowEnd   = '';
  editIsActive    = true;

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
        this.messageSvc.add({ severity: 'error', summary: '오류', detail: '출석 정의를 불러올 수 없습니다.' });
        this.loading.set(false);
      },
    });
  }

  dayLabel(day: DayOfWeek): string {
    return DAY_OF_WEEK_LABELS[day];
  }

  formatTime(time: string): string {
    return time?.slice(0, 5) ?? '';
  }

  onDefinitionChange(): void {
    this.loadGroupCounts();
  }

  onDateChange(): void {
    this.ensureSelectedDefinition(this.definitions(), true);
    this.loadGroupCounts();
  }

  loadGroupCounts(): void {
    const date = this.selectedDateIso();
    if (!this.selectedDefinitionId || !date) {
      this.groupCounts.set(null);
      return;
    }

    this.countsLoading.set(true);
    this.service.getGroupCounts({
      definitionId: this.selectedDefinitionId,
      date,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: counts => {
        this.groupCounts.set(counts);
        this.groupFilter.set([]);
        this.countsLoading.set(false);
      },
      error: err => {
        const detail = err?.message ?? '출석 집계를 불러올 수 없습니다.';
        this.messageSvc.add({ severity: 'error', summary: '오류', detail });
        this.groupCounts.set(null);
        this.countsLoading.set(false);
      },
    });
  }

  groupDisplayName(group: ChurchGroupAttendanceCountResponse): string {
    if (!group.groupName) return this.columnLabels.noGroup;
    return group.groupDivision
      ? `${this.divisionLabel(group.groupDivision)} · ${group.groupName}`
      : group.groupName;
  }

  /** Korean display label for a division, mapping legacy codes (NEHEMIA/DANIEL). */
  divisionLabel(division: string | null): string {
    if (!division) return '';
    return DIVISION_LABELS[division.toUpperCase()] ?? division;
  }

  /** Division tag color: 느헤미야 → blue (info), 다니엘 → green (success). */
  divisionSeverity(division: string | null): 'info' | 'success' | 'secondary' {
    const key = (division ?? '').toUpperCase();
    if (key.startsWith('NEHEMIA') || division === '느헤미야') return 'info';
    if (key.startsWith('DANIEL') || division === '다니엘') return 'success';
    return 'secondary';
  }

  groupShare(group: ChurchGroupAttendanceCountResponse): number {
    const total = this.groupCounts()?.totalCount ?? 0;
    if (total === 0) return 0;
    return Math.round((group.attendanceCount / total) * 100);
  }

  toggleSort(field: 'attendanceCount' | 'share'): void {
    if (this.sortField() === field) {
      this.sortOrder.set(this.sortOrder() === 1 ? -1 : 1);
    } else {
      this.sortField.set(field);
      this.sortOrder.set(-1);
    }
  }

  sortIcon(field: 'attendanceCount' | 'share'): string {
    if (this.sortField() !== field) return 'pi pi-sort-alt';
    return this.sortOrder() === 1 ? 'pi pi-sort-amount-up' : 'pi pi-sort-amount-down';
  }

  onCreateSubmit(): void {
    if (!this.createTitle.trim() || !this.createDayOfWeek || !this.createWindowStart || !this.createWindowEnd) {
      this.messageSvc.add({ severity: 'warn', summary: '입력 오류', detail: '모든 항목을 입력해주세요.' });
      return;
    }
    this.service.createDefinition({
      title: this.createTitle.trim(),
      dayOfWeek: this.createDayOfWeek,
      windowStart: this.createWindowStart,
      windowEnd: this.createWindowEnd,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: created => {
        this.messageSvc.add({ severity: 'success', summary: '완료', detail: '출석 정의가 생성되었습니다.' });
        this.resetCreateForm();
        this.showCreate.set(false);
        this.selectedDefinitionId = created.publicId;
        this.load();
      },
      error: err => {
        const detail = err?.message ?? '생성에 실패했습니다.';
        this.messageSvc.add({ severity: 'error', summary: '오류', detail });
      },
    });
  }

  openEdit(def: DefinitionDto): void {
    this.editTarget      = def;
    this.editTitle       = def.title;
    this.editDayOfWeek   = def.dayOfWeek;
    this.editWindowStart = def.windowStart.slice(0, 5);
    this.editWindowEnd   = def.windowEnd.slice(0, 5);
    this.editIsActive    = def.isActive;
    this.showEditDialog  = true;
  }

  onEditSave(): void {
    if (!this.editTarget) return;
    this.service.updateDefinition(this.editTarget.publicId, {
      title:       this.editTitle.trim() || undefined,
      dayOfWeek:   this.editDayOfWeek ?? undefined,
      windowStart: this.editWindowStart || undefined,
      windowEnd:   this.editWindowEnd || undefined,
      isActive:    this.editIsActive,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.messageSvc.add({ severity: 'success', summary: '완료', detail: '수정되었습니다.' });
        this.showEditDialog = false;
        this.load();
      },
      error: err => {
        const detail = err?.message ?? '수정에 실패했습니다.';
        this.messageSvc.add({ severity: 'error', summary: '오류', detail });
      },
    });
  }

  confirmDeactivate(def: DefinitionDto, event: Event): void {
    this.confirmSvc.confirm({
      target: event.target as EventTarget,
      message: `"${def.title}" 출석 정의를 비활성화하시겠습니까?`,
      header: '비활성화 확인',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '비활성화',
      rejectLabel: '취소',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deactivate(def),
    });
  }

  private deactivate(def: DefinitionDto): void {
    this.service.deactivateDefinition(def.publicId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.messageSvc.add({ severity: 'success', summary: '완료', detail: '비활성화되었습니다.' });
        this.load();
      },
      error: () => {
        this.messageSvc.add({ severity: 'error', summary: '오류', detail: '비활성화에 실패했습니다.' });
      },
    });
  }

  viewLogs(def: DefinitionDto): void {
    this.router.navigate(['/attendance', def.publicId, 'group-counts']);
  }

  private ensureSelectedDefinition(
    definitions: DefinitionDto[],
    preferSelectedDate = false,
  ): void {
    const selected = definitions.find(def => def.publicId === this.selectedDefinitionId);
    const selectedDateDay = this.selectedDate ? this.dayOfWeekForDate(this.selectedDate) : null;

    if (selected && (!preferSelectedDate || selected.dayOfWeek === selectedDateDay)) return;

    const matchingDefinition = selectedDateDay
      ? definitions.find(def => def.isActive && def.dayOfWeek === selectedDateDay)
        ?? definitions.find(def => def.dayOfWeek === selectedDateDay)
      : null;
    const defaultDefinition = matchingDefinition ?? definitions.find(def => def.isActive) ?? definitions[0];
    this.selectedDefinitionId = defaultDefinition?.publicId ?? '';
  }

  private dayOfWeekForDate(date: Date): DayOfWeek {
    const days: DayOfWeek[] = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    return days[date.getDay()];
  }

  private selectedDateIso(): string | null {
    if (!this.selectedDate) return null;
    const y = this.selectedDate.getFullYear();
    const m = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private resetCreateForm(): void {
    this.createTitle       = '';
    this.createDayOfWeek   = null;
    this.createWindowStart = '';
    this.createWindowEnd   = '';
  }
}
