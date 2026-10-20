import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { ChartComponent, ChartSeries } from '../../core/ui/chart/chart.component';
import { EmptyStateComponent } from '../../core/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header.component';
import { SkeletonComponent } from '../../core/ui/skeleton/skeleton.component';
import { StatCardComponent } from '../../core/ui/stat-card/stat-card.component';
import { GUIDE_STATISTIC_KEYS, GuideStatisticKey, GuideStatisticPeriod, GuideStatisticReason, guideTimelineWithGaps } from './guide-statistics.model';
import { GuideStatisticsService } from './guide-statistics.service';

@Component({
  selector: 'app-guide-statistics', standalone: true, providers: [GuideStatisticsService],
  imports: [FormsModule, RouterLink, TranslatePipe, ButtonModule, SelectModule, DatePickerModule, ChartComponent, EmptyStateComponent, PageHeaderComponent, SkeletonComponent, StatCardComponent],
  templateUrl: './guide-statistics.component.html', host: { class: 'block min-w-0' },
})
export class GuideStatisticsComponent {
  readonly state = inject(GuideStatisticsService);
  private readonly translate = inject(TranslateService);
  readonly keys = GUIDE_STATISTIC_KEYS;
  readonly years = Array.from({ length: Math.max(1, new Date().getFullYear() - 2020) }, (_, index) => new Date().getFullYear() - index);
  cutoff(): Date | null { const value = this.state.asOf(); return value ? new Date(value + 'T12:00:00') : null; }
  cutoffChanged(value: Date | null): void {
    if (!value) { this.state.load(this.state.year(), ''); return; }
    const date = [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
    this.state.load(value.getFullYear(), date);
  }
  yearStart(): Date { return new Date(this.state.year(), 0, 1); }
  yearEnd(): Date { return new Date(this.state.year(), 11, 31); }
  readonly visible = signal<GuideStatisticKey[]>([...GUIDE_STATISTIC_KEYS]);
  readonly periods = ['current', 'previousSamePeriod', 'previousFullYear'] as const;
  readonly rows = [
    { label: 'current', period: 'current', field: 'average' }, { label: 'share', period: 'current', field: 'sharePercent' },
    { label: 'previousSamePeriod', period: 'previousSamePeriod', field: 'average' },
    { label: 'previousFullYear', period: 'previousFullYear', field: 'average' }, { label: 'share', period: 'previousFullYear', field: 'sharePercent' },
    { label: 'sameAbsolute', change: 'changesFromSamePeriod', field: 'absoluteChange' }, { label: 'samePercent', change: 'changesFromSamePeriod', field: 'percentChange' },
    { label: 'fullAbsolute', change: 'changesFromFullYear', field: 'absoluteChange' }, { label: 'fullPercent', change: 'changesFromFullYear', field: 'percentChange' },
  ] as const;
  readonly points = computed(() => guideTimelineWithGaps(this.state.data()?.timeline ?? []));
  constructor() { this.state.load(); }
  label(key: GuideStatisticKey): string { return this.translate.instant('guide.statistics.keys.' + key); }
  text(key: string): string { return this.translate.instant('guide.statistics.' + key); }
  format(value: number | null | undefined, percent = false): string {
    return value == null ? '—' : value.toLocaleString(this.translate.getCurrentLang() === 'ko' ? 'ko-KR' : 'en-US', { maximumFractionDigits: 1 }) + (percent ? '%' : '');
  }
  metric(period: GuideStatisticPeriod, key: GuideStatisticKey) { return period.metrics.find(metric => metric.key === key); }
  cell(row: typeof this.rows[number], key: GuideStatisticKey): { value: number | null; reason: GuideStatisticReason | null } {
    const data = this.state.data(); if (!data) return { value: null, reason: null };
    if ('period' in row) {
      const metric = this.metric(data[row.period], key);
      return { value: metric?.[row.field] ?? null, reason: (row.field === 'average' ? metric?.averageReason : metric?.shareReason) ?? null };
    }
    const change = data[row.change].find(value => value.key === key);
    return { value: change?.[row.field] ?? null, reason: (row.field === 'absoluteChange' ? change?.absoluteReason : change?.percentReason) ?? null };
  }
  toggle(key: GuideStatisticKey): void { this.visible.update(keys => keys.includes(key) ? keys.filter(item => item !== key) : [...keys, key]); }
  line(): ChartSeries[] {
    return this.keys.filter(key => this.visible().includes(key)).map(key => ({ label: this.label(key),
      data: this.points().map(point => key === 'TOTAL' ? point.totalCount : point[({ SERVICE_1: 'service1Count', SERVICE_2: 'service2Count', SERVICE_3: 'service3Count' } as const)[key]]) }));
  }
  bars(): ChartSeries[] {
    const data = this.state.data(); return data ? this.periods.map(period => ({ label: this.text(period),
      data: this.keys.slice(0, 3).map(key => this.metric(data[period], key)?.average ?? null) })) : [];
  }
  shares(): ChartSeries[] {
    const period = this.state.data()?.current;
    return [{ label: this.text('share'), data: this.keys.slice(0, 3).map(key => period ? this.metric(period, key)?.sharePercent ?? null : null) }];
  }
  labels(): string[] { return this.points().map(point => point.serviceDate); }
  shareLabels(): string[] {
    const period = this.state.data()?.current;
    return this.keys.slice(0, 3).map(key => {
      const metric = period ? this.metric(period, key) : null;
      return `${this.label(key)} · ${this.format(metric?.sharePercent, true)} · ${this.format(metric?.sum)} ${this.text('visits')}`;
    });
  }
  serviceLabels(): string[] { return this.keys.slice(0, 3).map(key => this.label(key)); }
  totalChange(): number | null { return this.state.data()?.changesFromSamePeriod.find(change => change.key === 'TOTAL')?.percentChange ?? null; }
  date(value: string): string { return value.replaceAll('-', '.'); }
}
