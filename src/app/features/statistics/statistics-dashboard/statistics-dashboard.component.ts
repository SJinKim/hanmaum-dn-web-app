import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of, switchMap, tap } from 'rxjs';

import { ChartComponent, ChartSeries } from '../../../core/ui/chart/chart.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { ProgressBarComponent } from '../../../core/ui/progress-bar/progress-bar.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import {
  SegmentOption,
  SegmentedControlComponent,
} from '../../../core/ui/segmented-control/segmented-control.component';
import { ChartDatum, DashboardStats, StatisticsPeriod } from '../statistics.model';
import { StatisticsService } from '../statistics.service';

const PERIODS: { value: StatisticsPeriod; key: string }[] = [
  { value: '30d', key: 'last30Days' },
  { value: 'quarter', key: 'quarter' },
  { value: 'year', key: 'year' },
];

/** `2026-01` is a month bucket, `2026-10-07` a day bucket. */
const MONTH_BUCKET = /^\d{4}-\d{2}$/;

/**
 * 통계 (#60, #184) — Figma: Light 193:3961, Dark 197:2984.
 *
 * Every chart reads the dashboard endpoint (server #229). The period switch
 * reloads it; 성별 분포, 양육 단계, 예배별 집계 and 사역별 인원 are snapshots
 * and do not change with it.
 */
@Component({
  selector: 'app-statistics-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
    ChartComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    ProgressBarComponent,
    SegmentedControlComponent,
    SkeletonComponent,
  ],
  templateUrl: './statistics-dashboard.component.html',
})
export class StatisticsDashboardComponent {
  private readonly service = inject(StatisticsService);
  private readonly translate = inject(TranslateService);

  /** Recomputes the translated labels when the language changes. */
  private readonly lang = toSignal(this.translate.onLangChange);

  readonly loading = signal(true);
  readonly stats = signal<DashboardStats | null>(null);
  /** Figma shows 분기 selected. */
  readonly period = signal<StatisticsPeriod>('quarter');

  constructor() {
    toObservable(this.period)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(period => this.service.getDashboard(period).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe(stats => {
        this.stats.set(stats);
        this.loading.set(false);
      });
  }

  readonly periodOptions = computed<SegmentOption[]>(() => {
    this.lang();
    return PERIODS.map(({ value, key }) => ({
      value,
      label: this.translate.instant(`statistics.period.${key}`),
    }));
  });

  onPeriodChange(value: string): void {
    const period = PERIODS.find(p => p.value === value)?.value;
    if (period) this.period.set(period);
  }

  /** "자매 52 %" — the donut legend carries the share, as in Figma. */
  readonly genderLabels = computed<string[]>(() =>
    this.shareLabels(this.stats()?.genderDistribution ?? [], false),
  );

  readonly genderSeries = computed<ChartSeries[]>(() =>
    this.donutSeries(this.stats()?.genderDistribution ?? [], 'statistics.charts.gender'),
  );

  /** The previous year runs past today's bucket, so its labels are the full axis. */
  readonly growthLabels = computed<string[]>(() => {
    const series = this.stats()?.growthTrend ?? [];
    const longest = series.reduce<ChartDatum[]>((acc, s) => (s.points.length > acc.length ? s.points : acc), []);
    return this.bucketLabels(longest);
  });

  readonly growthSeries = computed<ChartSeries[]>(() => {
    this.lang();
    const series = this.stats()?.growthTrend ?? [];
    if (series.every(s => s.points.length === 0)) return [];
    return series.map(s => ({
      label: this.translate.instant('statistics.yearLabel', { year: s.year }),
      data: s.points.map(p => p.value),
    }));
  });

  readonly attendanceLabels = computed(() => this.bucketLabels(this.stats()?.attendanceRate ?? []));

  readonly attendanceSeries = computed<ChartSeries[]>(() =>
    this.barSeries(this.stats()?.attendanceRate ?? [], 'statistics.charts.attendanceRate'),
  );

  readonly trainingStages = computed(() => {
    const stages = this.stats()?.trainingStages ?? [];
    const max = Math.max(0, ...stages.map(s => s.count));
    return stages.map(s => ({ ...s, percent: max ? (s.count / max) * 100 : 0 }));
  });

  readonly trainingTotal = computed(() => this.trainingStages().reduce((sum, s) => sum + s.count, 0));

  /** "1부 · 07:30", as the Figma axis labels. */
  readonly serviceLabels = computed(() =>
    (this.stats()?.serviceAttendance ?? []).map(s => `${s.title} · ${s.windowStart.slice(0, 5)}`),
  );

  readonly serviceSeries = computed<ChartSeries[]>(() => {
    this.lang();
    const services = this.stats()?.serviceAttendance ?? [];
    if (services.length === 0) return [];
    return [
      { label: this.translate.instant('statistics.thisWeek'), data: services.map(s => s.thisWeek) },
      { label: this.translate.instant('statistics.lastWeek'), data: services.map(s => s.lastWeek) },
    ];
  });

  /** "다니엘 128명 · 58 %" — count and share, as in Figma. */
  readonly divisionLabels = computed<string[]>(() =>
    this.shareLabels(this.stats()?.divisionAttendance ?? [], true),
  );

  readonly divisionSeries = computed<ChartSeries[]>(() =>
    this.donutSeries(this.stats()?.divisionAttendance ?? [], 'statistics.charts.groupShare'),
  );

  readonly ministryLabels = computed(() => (this.stats()?.ministryHeadcount ?? []).map(d => d.label));

  readonly ministrySeries = computed<ChartSeries[]>(() =>
    this.barSeries(this.stats()?.ministryHeadcount ?? [], 'statistics.charts.ministries'),
  );

  /** Months read "1월" / "Jan", days "10. 7." / "10/7", in the active language. */
  private bucketLabels(points: ChartDatum[]): string[] {
    this.lang();
    const locale = this.translate.getCurrentLang() || 'ko';
    const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    const day = new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
    return points.map(({ label }) => {
      if (MONTH_BUCKET.test(label)) return month.format(new Date(`${label}-01T00:00:00Z`));
      const date = new Date(`${label}T00:00:00Z`);
      return Number.isNaN(date.getTime()) ? label : day.format(date);
    });
  }

  private barSeries(data: ChartDatum[], key: string): ChartSeries[] {
    this.lang();
    if (data.length === 0) return [];
    return [{ label: this.translate.instant(key), data: data.map(d => d.value) }];
  }

  private donutSeries(data: ChartDatum[], key: string): ChartSeries[] {
    this.lang();
    if (data.every(d => d.value === 0)) return [];
    return [{ label: this.translate.instant(key), data: data.map(d => d.value) }];
  }

  private shareLabels(data: ChartDatum[], withCount: boolean): string[] {
    this.lang();
    const total = data.reduce((sum, d) => sum + d.value, 0);
    return data.map(d => {
      const share = `${total ? Math.round((d.value / total) * 100) : 0} %`;
      if (!withCount) return `${d.label} ${share}`;
      return `${d.label} ${this.translate.instant('statistics.people', { count: d.value })} · ${share}`;
    });
  }
}
