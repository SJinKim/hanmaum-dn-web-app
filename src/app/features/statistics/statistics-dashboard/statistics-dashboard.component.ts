import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ChartComponent, ChartSeries } from '../../../core/ui/chart/chart.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import {
  SegmentOption,
  SegmentedControlComponent,
} from '../../../core/ui/segmented-control/segmented-control.component';
import { DashboardStats } from '../statistics.model';
import { StatisticsService } from '../statistics.service';

/**
 * The two-up charts of Figma 통계 rows 2 and 3. Like 성장 추이 and 사역별 인원
 * no endpoint feeds them yet: they keep their place and show the chart's own
 * empty state instead of preview data — the aggregates belong on the server,
 * not in the client (#60).
 */
export const PAIRED_CHARTS = [
  { key: 'attendanceRate', type: 'bar' },
  { key: 'trainingStages', type: 'bar' },
  { key: 'services', type: 'bar' },
  { key: 'groupShare', type: 'donut' },
] as const;

/**
 * 통계 (#60) — Figma: Light 193:3961, Dark 197:2984.
 *
 * Only 성별 분포 has data today (`genderDistribution` of the dashboard
 * endpoint). The period switch is shown but inert: the endpoint takes no period.
 */
@Component({
  selector: 'app-statistics-dashboard',
  standalone: true,
  imports: [TranslatePipe, ChartComponent, PageHeaderComponent, SegmentedControlComponent],
  templateUrl: './statistics-dashboard.component.html',
})
export class StatisticsDashboardComponent implements OnInit {
  private readonly service = inject(StatisticsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  /** Recomputes the translated labels when the language changes. */
  private readonly lang = toSignal(this.translate.onLangChange);

  readonly loading = signal(true);
  readonly stats = signal<DashboardStats | null>(null);
  readonly period = signal('quarter');
  readonly pairedCharts = PAIRED_CHARTS;

  readonly periodOptions = computed<SegmentOption[]>(() => {
    this.lang();
    return ['last30Days', 'quarter', 'year'].map(value => ({
      value: value === 'last30Days' ? '30d' : value,
      label: this.translate.instant(`statistics.period.${value}`),
    }));
  });

  /** "자매 52 %" — the donut legend carries the share, as in Figma. */
  readonly genderLabels = computed<string[]>(() => {
    const data = this.stats()?.genderDistribution ?? [];
    const total = data.reduce((sum, d) => sum + d.value, 0);
    return data.map(d => `${d.label} ${total ? Math.round((d.value / total) * 100) : 0} %`);
  });

  readonly genderSeries = computed<ChartSeries[]>(() => {
    const data = this.stats()?.genderDistribution ?? [];
    if (data.every(d => d.value === 0)) return [];
    return [{ label: this.translate.instant('statistics.charts.gender'), data: data.map(d => d.value) }];
  });

  ngOnInit(): void {
    this.service
      .getDashboard()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: stats => {
          this.stats.set(stats);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
