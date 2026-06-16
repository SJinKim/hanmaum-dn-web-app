import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { AttendanceService } from '../attendance.service';
import { AttendanceGroupCountsResponse, ChurchGroupAttendanceCountResponse } from '../attendance.model';

@Component({
  selector: 'app-attendance-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DatePickerModule,
    ProgressBarModule,
    ToastModule,
    TooltipModule,
  ],
  providers: [MessageService],
  templateUrl: './attendance-logs.component.html',
})
export class AttendanceLogsComponent implements OnInit {
  private readonly service    = inject(AttendanceService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly messageSvc = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  definitionPublicId = '';
  groupCounts        = signal<AttendanceGroupCountsResponse | null>(null);
  loading            = signal(false);
  selectedDate: Date | null = new Date();

  readonly sortedGroups = computed(() => {
    const groups = this.groupCounts()?.groups ?? [];
    return [...groups].sort((a, b) => {
      if (b.attendanceCount !== a.attendanceCount) return b.attendanceCount - a.attendanceCount;
      return this.groupDisplayName(a).localeCompare(this.groupDisplayName(b), 'ko');
    });
  });

  readonly maxGroupCount = computed(() =>
    Math.max(1, ...this.sortedGroups().map(group => group.attendanceCount)),
  );

  ngOnInit(): void {
    this.definitionPublicId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadGroupCounts();
  }

  loadGroupCounts(): void {
    const date = this.selectedDateIso();
    if (!this.definitionPublicId || !date) return;

    this.loading.set(true);
    this.service.getGroupCounts({
      definitionId: this.definitionPublicId,
      date,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: counts => {
        this.groupCounts.set(counts);
        this.loading.set(false);
      },
      error: err => {
        const detail = err?.message ?? '그룹별 출석 집계를 불러올 수 없습니다.';
        this.messageSvc.add({ severity: 'error', summary: '오류', detail });
        this.groupCounts.set(null);
        this.loading.set(false);
      },
    });
  }

  clearDate(): void {
    this.selectedDate = new Date();
    this.loadGroupCounts();
  }

  groupDisplayName(group: ChurchGroupAttendanceCountResponse): string {
    if (!group.groupName) return '소속 그룹 없음';
    return group.groupDivision ? `${group.groupDivision} · ${group.groupName}` : group.groupName;
  }

  groupShare(group: ChurchGroupAttendanceCountResponse): number {
    const total = this.groupCounts()?.totalCount ?? 0;
    if (total === 0) return 0;
    return Math.round((group.attendanceCount / total) * 100);
  }

  groupBarValue(group: ChurchGroupAttendanceCountResponse): number {
    return Math.round((group.attendanceCount / this.maxGroupCount()) * 100);
  }

  goBack(): void {
    this.router.navigate(['/attendance']);
  }

  private selectedDateIso(): string | null {
    if (!this.selectedDate) return null;
    const y = this.selectedDate.getFullYear();
    const m = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
