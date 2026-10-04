import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { forkJoin } from 'rxjs';

import { Gender } from '../../../core/models/member.model';
import { localDateToIso } from '../../../core/models/member-activity.model';
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

/** Days of history the table shows, ending today. */
export const VISIT_HISTORY_DAYS = 30;

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
 * Figma: 새가족 / 방문 기록 (Desktop 967:98043, Tablet 967:98575, Phone 967:99107).
 *
 * The quick capture for the service day: a visitor is written down in seconds,
 * kept as history and evaluated later — how many registered as 새가족, how many
 * graduated, which 알게 된 경로 brought them. Every figure comes from
 * `GET /newcomers/visits/stats`; nothing is counted in the client.
 *
 * Deviation from #40: the issue's "방문 여부" is `visitType` (처음 방문 / 재방문)
 * plus `source`, as in Figma and the server contract.
 */
@Component({
  selector: 'app-newcomer-visits',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
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
  providers: [MessageService],
  host: { class: 'flex h-full flex-col' },
  templateUrl: './newcomer-visits.component.html',
})
export class NewcomerVisitsComponent implements OnInit {
  private readonly visitService = inject(NewcomerVisitService);
  private readonly roles = inject(RoleService);
  private readonly breakpoints = inject(BreakpointService);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);
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
    return [
      { type: 'date', key: 'visitDate', header: header('visitDate'), width: '120px' },
      { type: 'avatar-name', key: 'name', header: header('name'), width: '160px' },
      { type: 'text', key: 'gender', header: header('gender'), sortable: false, width: '80px' },
      { type: 'text', key: 'birthYear', header: header('birthYear'), sortable: false, width: '100px' },
      { type: 'text', key: 'visitType', header: header('visitType'), sortable: false, width: '120px' },
      { type: 'badge', key: 'status', header: header('status'), sortable: false, width: '140px' },
    ];
  });

  readonly tableRows = computed<DataRecord[]>(() => {
    this.translate.currentLang();
    return this.visits().map(v => ({
      id: v.publicId,
      title: v.fullName,
      cells: {
        visitDate: v.visitDate,
        gender: v.gender ? (this.translate.instant(`newcomers.gender.${v.gender}`) as string) : '—',
        birthYear: v.birthYear != null ? String(v.birthYear) : '—',
        visitType: this.translate.instant(`newcomers.visits.type.${v.visitType}`) as string,
        status: this.statusBadge(v),
      },
    }));
  });

  /** Phone: 성별 · 출생연도 · 구분 as subtitle, 상태 as badge, 방문일 as meta. */
  readonly records = computed<readonly DataRecord[]>(() => {
    this.translate.currentLang();
    return this.visits().map(v => ({
      id: v.publicId,
      title: v.fullName,
      subtitle: [
        v.gender ? (this.translate.instant(`newcomers.gender.${v.gender}`) as string) : null,
        v.birthYear,
        this.translate.instant(`newcomers.visits.type.${v.visitType}`) as string,
      ]
        .filter(part => part != null)
        .join(' · '),
      badge: this.statusBadge(v),
      meta: v.visitDate,
    }));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    const today = new Date();
    const iso = (d: Date) => localDateToIso(d)!;
    const todayIso = iso(today);
    const historyStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (VISIT_HISTORY_DAYS - 1));
    const month: VisitRange = { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: todayIso };
    const year: VisitRange = { from: `${today.getFullYear()}-01-01`, to: todayIso };

    forkJoin({
      visits: this.visitService.getVisits({ from: iso(historyStart), to: todayIso }),
      today: this.visitService.getStats({ from: todayIso, to: todayIso }),
      month: this.visitService.getStats(month),
      year: this.visitService.getStats(year),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ visits, today: t, month: m, year: y }) => {
          this.visits.set([...visits].sort((a, b) => b.visitDate.localeCompare(a.visitDate)));
          this.kpis.set({ today: t, month: m, year: y });
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
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
    this.visitService
      .createVisit(this.toRequest())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: saved => {
          this.messages.add({
            severity: 'success',
            summary: this.translate.instant('newcomers.toast.done') as string,
            detail: this.translate.instant('newcomers.visits.toast.saved', { name: saved.fullName }) as string,
          });
          this.saving.set(false);
          this.reset();
          this.load();
        },
        error: () => {
          this.messages.add({
            severity: 'error',
            summary: this.translate.instant('newcomers.toast.error') as string,
            detail: this.translate.instant('newcomers.visits.toast.saveFailed') as string,
          });
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

  goToList(): void {
    void this.router.navigate(['/newcomers']);
  }

  private statusBadge(v: NewcomerVisit): DataRecordBadge {
    return v.newcomerPublicId
      ? { variant: 'active', label: this.translate.instant('newcomers.visits.status.registered') as string }
      : { variant: 'pending', label: this.translate.instant('newcomers.visits.status.visited') as string };
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
