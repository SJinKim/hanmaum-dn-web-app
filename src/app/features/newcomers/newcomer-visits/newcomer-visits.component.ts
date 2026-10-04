import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { forkJoin } from 'rxjs';

import { Gender } from '../../../core/models/member.model';
import { isoToLocalDate, localDateToIso } from '../../../core/models/member-activity.model';
import {
  CreateNewcomerVisitRequest,
  NEWCOMER_VISIT_SOURCES,
  NewcomerVisit,
  NewcomerVisitSource,
  NewcomerVisitStats,
  NewcomerVisitType,
} from '../../../core/models/newcomer-visit.model';
import { RoleService } from '../../../core/services/role.service';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { DataColumn, DataRecord, DataRecordBadge } from '../../../core/ui/data-record.model';
import { DataTableComponent } from '../../../core/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { ListCardComponent } from '../../../core/ui/list-card/list-card.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SegmentedControlComponent } from '../../../core/ui/segmented-control/segmented-control.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { StatCardComponent } from '../../../core/ui/stat-card/stat-card.component';
import { NewcomerVisitService, VisitRange } from '../newcomer-visit.service';

/** Rows per page of 방문 기록. */
export const VISIT_PAGE_SIZE = 20;

/** The period select of 방문 기록; `all` sends no `from` (전체). */
export type VisitPeriod = '30d' | '3m' | 'year' | 'all';

export const VISIT_PERIODS: readonly VisitPeriod[] = ['30d', '3m', 'year', 'all'];

/** First day of `period`, ending `today`; null for 전체. */
export function periodStart(period: VisitPeriod, today: Date): Date | null {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  switch (period) {
    case '30d':
      return new Date(y, m, d - 29);
    case '3m':
      return new Date(y, m - 3, d + 1);
    case 'year':
      return new Date(y, 0, 1);
    case 'all':
      return null;
  }
}

interface VisitKpis {
  readonly today: NewcomerVisitStats;
  readonly month: NewcomerVisitStats;
  readonly year: NewcomerVisitStats;
}

/** Share in whole percent, 0 when there is nothing to divide by. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Figma: 빠른 기록 (Desktop 981:99781, 수정 984:104316, 삭제 확인 987:102961).
 *
 * The quick capture for the service day: a visitor is written down in seconds
 * and kept as history for the pastor. It stays apart from the 새가족 profiles —
 * a newcomer registers through the QR code, and no record is linked to one.
 * Every figure comes from `GET /newcomers/visits/stats`; nothing is counted in
 * the client, and the server pages and orders 방문 기록 (#265).
 *
 * 수정 loads a record into the form on the left, which stays where it is; 삭제
 * asks first. Both need `canWrite('newcomers')`, the 새가족 사역 team.
 */
@Component({
  selector: 'app-newcomer-visits',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    ConfirmDialogModule,
    DatePickerModule,
    InputTextModule,
    RadioButtonModule,
    SelectModule,
    TextareaModule,
    ToastModule,
    PageHeaderComponent,
    StatCardComponent,
    SegmentedControlComponent,
    DataTableComponent,
    ListCardComponent,
    EmptyStateComponent,
    SkeletonComponent,
  ],
  providers: [ConfirmationService, MessageService],
  host: { class: 'flex flex-col' },
  templateUrl: './newcomer-visits.component.html',
})
export class NewcomerVisitsComponent implements OnInit {
  private readonly visitService = inject(NewcomerVisitService);
  private readonly roles = inject(RoleService);
  private readonly breakpoints = inject(BreakpointService);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly isPhone = this.breakpoints.isPhone;
  readonly canWrite = computed(() => this.roles.canWrite('newcomers'));

  readonly visits = signal<readonly NewcomerVisit[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly kpis = signal<VisitKpis | null>(null);
  readonly saving = signal(false);

  readonly period = signal<VisitPeriod>('30d');
  readonly page = signal(0);
  readonly total = signal(0);
  readonly size = VISIT_PAGE_SIZE;

  /** The record the form edits; null while it captures a new one. */
  readonly editing = signal<NewcomerVisit | null>(null);

  readonly form = this.fb.group({
    visitDate: this.fb.control<Date | null>(new Date(), Validators.required),
    lastName: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(50)]),
    firstName: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(50)]),
    birthYear: this.fb.control<number | null>(null, [Validators.min(1900), Validators.max(2100)]),
    gender: this.fb.control<Gender | null>(null),
    visitType: this.fb.nonNullable.control<NewcomerVisitType>('FIRST'),
    source: this.fb.control<NewcomerVisitSource | null>(null),
    note: this.fb.nonNullable.control('', Validators.maxLength(1000)),
  });

  /** The segmented control is not a form control; it mirrors `gender`. */
  readonly gender = signal<string>('');

  readonly genderOptions = computed(() => {
    this.translate.currentLang();
    return (['M', 'F'] as const).map(value => ({
      value,
      label: this.translate.instant(`newcomers.gender.${value}`) as string,
    }));
  });

  readonly visitTypes: readonly NewcomerVisitType[] = ['FIRST', 'REVISIT'];

  readonly sourceOptions = computed(() => {
    this.translate.currentLang();
    return NEWCOMER_VISIT_SOURCES.map(value => ({
      value,
      label: this.translate.instant(`newcomers.visits.source.${value}`) as string,
    }));
  });

  readonly periodOptions = computed(() => {
    this.translate.currentLang();
    return VISIT_PERIODS.map(value => ({
      value,
      label: this.translate.instant(`newcomers.visits.period.${value}`) as string,
    }));
  });

  readonly rangeParams = computed(() => {
    const total = this.total();
    const first = total === 0 ? 0 : this.page() * this.size + 1;
    return { from: first, to: Math.min((this.page() + 1) * this.size, total), total };
  });

  readonly hasPages = computed(() => this.total() > this.size);
  readonly lastPage = computed(() => Math.max(0, Math.ceil(this.total() / this.size) - 1));

  /** 오늘 방문 · 이번 달 새가족 등록 · 올해 등반, Figma's three StatCards. */
  readonly statCards = computed(() => {
    this.translate.currentLang();
    const kpis = this.kpis();
    const t = (key: string, params?: object) => this.translate.instant(`newcomers.visits.kpi.${key}`, params) as string;
    if (!kpis) {
      return [
        { label: t('today'), value: '—', subtext: '' },
        { label: t('registered'), value: '—', subtext: '' },
        { label: t('graduated'), value: '—', subtext: '' },
      ];
    }
    const { today, month, year } = kpis;
    return [
      {
        label: t('today'),
        value: t('people', { n: today.visits }),
        subtext: t('todaySub', { first: today.firstVisits, revisit: today.revisits }),
      },
      {
        label: t('registered'),
        value: t('ratio', { part: month.registered, whole: month.visits }),
        subtext: t('registeredSub', { pct: percent(month.registered, month.visits) }),
      },
      {
        label: t('graduated'),
        value: t('people', { n: year.graduated }),
        subtext: t('graduatedSub', { pct: percent(year.graduated, year.registered) }),
      },
    ];
  });

  readonly columns = computed<DataColumn[]>(() => {
    this.translate.currentLang();
    const header = (key: string) => this.translate.instant(`newcomers.visits.columns.${key}`) as string;
    const columns: DataColumn[] = [
      { type: 'date', key: 'visitDate', header: header('visitDate'), sortable: false, width: '110px' },
      { type: 'avatar-name', key: 'name', header: header('name'), sortable: false, width: '150px' },
      { type: 'text', key: 'gender', header: header('gender'), sortable: false, width: '70px' },
      { type: 'text', key: 'birthYear', header: header('birthYear'), sortable: false, width: '90px' },
      { type: 'text', key: 'visitType', header: header('visitType'), sortable: false, width: '90px' },
      { type: 'text', key: 'source', header: header('source'), sortable: false, width: '120px' },
      { type: 'text', key: 'note', header: header('note'), sortable: false, tone: 'muted' },
    ];
    if (this.canWrite()) columns.push({ type: 'actions', header: header('actions'), width: '96px' });
    return columns;
  });

  readonly tableRows = computed<DataRecord[]>(() => {
    this.translate.currentLang();
    return this.visits().map(v => ({
      id: v.publicId,
      title: v.fullName,
      cells: {
        visitDate: v.visitDate,
        gender: this.genderLabel(v) ?? '—',
        birthYear: v.birthYear != null ? String(v.birthYear) : '—',
        visitType: this.translate.instant(`newcomers.visits.type.${v.visitType}`) as string,
        source: this.sourceLabel(v) ?? '—',
        note: v.note ?? '—',
      },
    }));
  });

  /** Phone: 성별 · 출생연도 · 경로 as subtitle, 구분 as badge, 방문일 as meta. */
  readonly records = computed<readonly DataRecord[]>(() => {
    this.translate.currentLang();
    return this.visits().map(v => ({
      id: v.publicId,
      title: v.fullName,
      subtitle: [this.genderLabel(v), v.birthYear, this.sourceLabel(v)]
        .filter(part => part != null)
        .join(' · '),
      badge: this.typeBadge(v),
      meta: v.visitDate,
    }));
  });

  ngOnInit(): void {
    this.load();
  }

  /** 방문 기록 and the three KPIs; a save or delete changes both. */
  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    const today = new Date();
    const iso = (d: Date) => localDateToIso(d)!;
    const todayIso = iso(today);
    const month: VisitRange = { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: todayIso };
    const year: VisitRange = { from: `${today.getFullYear()}-01-01`, to: todayIso };

    forkJoin({
      visits: this.visitService.getVisits(this.pageQuery(today)),
      today: this.visitService.getStats({ from: todayIso, to: todayIso }),
      month: this.visitService.getStats(month),
      year: this.visitService.getStats(year),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ visits, today: t, month: m, year: y }) => {
          this.visits.set(visits.content);
          this.total.set(visits.totalElements);
          this.kpis.set({ today: t, month: m, year: y });
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  /** 방문 기록 alone, for the period select and the pager. */
  loadVisits(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.visitService
      .getVisits(this.pageQuery(new Date()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.visits.set(page.content);
          this.total.set(page.totalElements);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  onPeriodChange(period: VisitPeriod): void {
    this.period.set(period);
    this.page.set(0);
    this.loadVisits();
  }

  prevPage(): void {
    if (this.page() === 0) return;
    this.page.update(p => p - 1);
    this.loadVisits();
  }

  nextPage(): void {
    if (this.page() >= this.lastPage()) return;
    this.page.update(p => p + 1);
    this.loadVisits();
  }

  onGenderChange(value: string): void {
    this.gender.set(value);
    this.form.controls.gender.setValue(value as Gender);
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  save(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const editing = this.editing();
    const request = this.toRequest();
    const call = editing
      ? // PATCH skips absent fields, so an emptied 기타사항 goes as "" to clear it.
        this.visitService.updateVisit(editing.publicId, { ...request, note: request.note ?? '' })
      : this.visitService.createVisit(request);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.toast('success', editing ? 'updated' : 'saved', { name: saved.fullName });
        this.saving.set(false);
        if (editing) {
          this.cancelEdit();
        } else {
          this.reset();
        }
        this.load();
      },
      error: () => {
        this.toast('error', editing ? 'updateFailed' : 'saveFailed');
        this.saving.set(false);
      },
    });
  }

  /** Clears everything but 방문일: the next visitor came the same day. */
  reset(): void {
    const visitDate = this.form.controls.visitDate.value ?? new Date();
    this.form.reset({ visitDate, visitType: 'FIRST' });
    this.gender.set('');
  }

  /** 수정: the form on the left takes the record. */
  startEdit(publicId: string): void {
    const visit = this.visits().find(v => v.publicId === publicId);
    if (!visit || !this.canWrite()) return;
    this.editing.set(visit);
    this.form.reset({
      visitDate: isoToLocalDate(visit.visitDate),
      lastName: visit.lastName,
      firstName: visit.firstName,
      birthYear: visit.birthYear,
      gender: visit.gender,
      visitType: visit.visitType,
      source: visit.source,
      note: visit.note ?? '',
    });
    this.gender.set(visit.gender ?? '');
  }

  /** Back to a new record, dated today. */
  cancelEdit(): void {
    this.editing.set(null);
    this.form.reset({ visitDate: new Date(), visitType: 'FIRST' });
    this.gender.set('');
  }

  confirmDelete(publicId: string): void {
    const visit = this.visits().find(v => v.publicId === publicId);
    if (!visit || !this.canWrite()) return;
    const t = (key: string, params?: object) => this.translate.instant(`newcomers.visits.delete.${key}`, params) as string;
    this.confirmService.confirm({
      header: t('header'),
      message: t('message', { name: visit.fullName, date: visit.visitDate }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: t('accept'),
      rejectLabel: t('cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => this.delete(visit),
    });
  }

  goToList(): void {
    void this.router.navigate(['/newcomers']);
  }

  private delete(visit: NewcomerVisit): void {
    this.visitService
      .deleteVisit(visit.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast('success', 'deleted', { name: visit.fullName });
          if (this.editing()?.publicId === visit.publicId) this.cancelEdit();
          // The last row of the last page is gone: step back one page.
          if (this.visits().length === 1 && this.page() > 0) this.page.update(p => p - 1);
          this.load();
        },
        error: () => this.toast('error', 'deleteFailed'),
      });
  }

  private pageQuery(today: Date) {
    const start = periodStart(this.period(), today);
    return {
      from: start ? localDateToIso(start)! : undefined,
      to: localDateToIso(today)!,
      page: this.page(),
      size: this.size,
    };
  }

  private toast(severity: 'success' | 'error', key: string, params?: object): void {
    this.messages.add({
      severity,
      summary: this.translate.instant(severity === 'success' ? 'newcomers.toast.done' : 'newcomers.toast.error') as string,
      detail: this.translate.instant(`newcomers.visits.toast.${key}`, params) as string,
    });
  }

  private genderLabel(v: NewcomerVisit): string | null {
    return v.gender ? (this.translate.instant(`newcomers.gender.${v.gender}`) as string) : null;
  }

  private sourceLabel(v: NewcomerVisit): string | null {
    return v.source ? (this.translate.instant(`newcomers.visits.source.${v.source}`) as string) : null;
  }

  private typeBadge(v: NewcomerVisit): DataRecordBadge {
    return {
      variant: v.visitType === 'FIRST' ? 'active' : 'pending',
      label: this.translate.instant(`newcomers.visits.type.${v.visitType}`) as string,
    };
  }

  private toRequest(): CreateNewcomerVisitRequest {
    const v = this.form.getRawValue();
    const note = v.note.trim();
    return {
      visitDate: localDateToIso(v.visitDate) ?? undefined,
      lastName: v.lastName.trim(),
      firstName: v.firstName.trim(),
      gender: v.gender ?? undefined,
      birthYear: v.birthYear ?? undefined,
      visitType: v.visitType,
      source: v.source ?? undefined,
      note: note ? note : undefined,
    };
  }
}
