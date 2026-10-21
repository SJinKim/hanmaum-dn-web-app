import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { GuideStatisticsService } from './guide-statistics.service';
import { GuideStatistics, GuideStatisticPoint, guideTimelineWithGaps } from './guide-statistics.model';

const point = (date: string, value: number | null): GuideStatisticPoint => ({ serviceDate: date, service1Count: value,
  service2Count: value, service3Count: value, totalCount: value, complete: value !== null });

describe('Guide statistics data and request lifecycle', () => {
  it('inserts null-only week markers without replacing actual zeros or partial counts', () => {
    const partial = { ...point('2026-10-25', null), service1Count: 7 };
    const source = [point('2026-10-04', 0), point('2026-10-18', 3), partial];
    const result = guideTimelineWithGaps(source);
    expect(result.map(item => item.serviceDate)).toEqual(['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
    expect(result.map(item => item.service1Count)).toEqual([0, null, 3, 7]);
    expect(result.map(item => item.totalCount)).toEqual([0, null, 3, null]);
    expect(source.length).toBe(3);
    expect(result[1].complete).toBeFalse();
  });
  it('anchors missing dates to Sundays across special weekday reports', () => {
    const result = guideTimelineWithGaps([point('2026-12-20', 3), point('2026-12-25', 4), point('2027-01-10', 5)]);
    expect(result.map(item => item.serviceDate)).toEqual(['2026-12-20', '2026-12-25', '2026-12-27', '2027-01-03', '2027-01-10']);
  });
  it('handles empty and consecutive timelines without invented reports', () => {
    expect(guideTimelineWithGaps([])).toEqual([]);
    const source = [point('2026-10-04', 0), point('2026-10-11', null)];
    expect(guideTimelineWithGaps(source)).toEqual(source);
  });
  let state: GuideStatisticsService;
  let api: jasmine.SpyObj<ApiService>;
  let requests: Subject<GuideStatistics>[];
  beforeEach(() => {
    requests = []; api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.callFake(() => { const result = new Subject<GuideStatistics>(); requests.push(result); return result.asObservable() as never; });
    TestBed.configureTestingModule({ providers: [GuideStatisticsService, { provide: ApiService, useValue: api }] });
    state = TestBed.inject(GuideStatisticsService);
  });
  const response = (year: number) => ({ year, asOf: `${year}-10-18` }) as GuideStatistics;
  it('uses the server default cutoff and the shared statistics endpoint', () => {
    state.load(2026, '');
    expect(api.get).toHaveBeenCalledWith('/v1/guide/worship-counts/statistics', { year: 2026 });
    requests[0].next(response(2026)); expect(state.asOf()).toBe('2026-10-18'); expect(state.loading()).toBeFalse();
  });
  it('refreshes and retries automatic cutoffs without pinning the resolved date', () => {
    state.load(2026, ''); requests[0].next(response(2026)); state.load();
    expect(api.get.calls.mostRecent().args[1]).toEqual({ year: 2026 });
    requests[1].error(new Error('offline')); state.load();
    expect(api.get.calls.mostRecent().args[1]).toEqual({ year: 2026 });
  });
  it('cancels stale responses and clears previous data immediately on filter change', () => {
    state.load(2026, ''); requests[0].next(response(2026));
    state.load(2025, ''); expect(state.data()).toBeNull(); expect(state.loading()).toBeTrue();
    requests[0].next(response(2026)); expect(state.data()).toBeNull();
    requests[1].next(response(2025)); expect(state.data()?.year).toBe(2025);
  });
  it('keeps request stream usable after a failure and retries the exact filter', () => {
    state.load(2026, '2026-10-18'); requests[0].error(new Error('offline'));
    expect(state.failed()).toBeTrue(); expect(state.loading()).toBeFalse(); expect(state.data()).toBeNull();
    state.load(); requests[1].next(response(2026)); expect(state.failed()).toBeFalse();
    expect(api.get).toHaveBeenCalledWith('/v1/guide/worship-counts/statistics', { year: 2026, asOf: '2026-10-18' });
  });
  it('rejects invalid years and mismatched cutoffs before sending requests', () => {
    state.load(1, ''); state.load(2026.1, ''); state.load(2026, '2025-10-18'); state.load(2026, 'bad');
    expect(api.get).not.toHaveBeenCalled();
  });
});

import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { GuideStatisticsComponent } from './guide-statistics.component';
import { GUIDE_STATISTIC_KEYS, GuideStatisticPeriod } from './guide-statistics.model';

describe('Guide statistics presentation uses API aggregates', () => {
  let component: GuideStatisticsComponent;
  function period(multiplier: number): GuideStatisticPeriod {
    return { from: '2026-01-01', to: '2026-10-18', firstReportDate: null, lastReportDate: null,
      firstCompleteDate: null, lastCompleteDate: null, reportCount: 42, completeCount: 42, incompleteCount: 0,
      metrics: GUIDE_STATISTIC_KEYS.map((key, index) => ({ key, sum: (index + 1) * multiplier * 42,
        average: (index + 1) * multiplier + .123456, averageReason: null, sharePercent: (index + 1) * 10,
        shareReason: null })) };
  }
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslateService(), provideRouter([]),
      { provide: ApiService, useValue: { get: () => new Subject<GuideStatistics>() } },
    ] });
    component = TestBed.createComponent(GuideStatisticsComponent).componentInstance;
    component.state.data.set({ year: 2026, asOf: '2026-10-18', comparisonYear: 2025, timeZone: 'Europe/Berlin',
      current: period(100), previousSamePeriod: period(90), previousFullYear: period(95),
      changesFromSamePeriod: GUIDE_STATISTIC_KEYS.map(key => ({ key, absoluteChange: 10, absoluteReason: null, percentChange: null, percentReason: 'ZERO_BASELINE' })),
      changesFromFullYear: [], timeline: [point('2026-10-04', 0), point('2026-10-18', 7)] });
  });
  it('keeps chart input identities stable until source or language changes', () => {
    expect(component.line()).toBe(component.line()); expect(component.bars()).toBe(component.bars());
    expect(component.shares()).toBe(component.shares()); expect(component.labels()).toBe(component.labels());
    expect(component.shareLabels()).toBe(component.shareLabels()); expect(component.serviceLabels()).toBe(component.serviceLabels());
    const old = component.line(); component.toggle('TOTAL'); expect(component.line()).not.toBe(old);
    const labels = component.serviceLabels();
    const translate = TestBed.inject(TranslateService); translate.setTranslation('ko', { guide: { statistics: { keys: { SERVICE_1: '1부' } } } }); translate.use('ko');
    expect(component.serviceLabels()).not.toBe(labels); expect(component.serviceLabels()[0]).toBe('1부');
  });
  it('uses identical unrounded server means in table and grouped bars', () => {
    const row = component.rows[0];
    const bars = component.bars();
    expect(bars[0].data).toEqual(component.keys.slice(0, 3).map(key => component.cell(row, key).value));
    expect(bars[0].data[0]).toBe(100.123456);
    expect(bars[1].data[0]).toBe(90.123456);
    expect(bars[2].data[0]).toBe(95.123456);
  });
  it('uses identical server shares in table and donut', () => {
    expect(component.shares()[0].data).toEqual(component.keys.slice(0, 3).map(key => component.cell(component.rows[1], key).value));
  });
  it('preserves unavailable comparison reasons and never formats Infinity or a false zero', () => {
    expect(component.cell(component.rows[6], 'TOTAL')).toEqual({ value: null, reason: 'ZERO_BASELINE' });
    expect(component.format(null, true)).toBe('—');
    expect(component.format(0, true)).toBe('0%');
  });
  it('keeps zeros and gaps when choosing visible phone series', () => {
    expect(component.line()[0].data).toEqual([0, null, 7]);
    component.toggle('SERVICE_1'); expect(component.line().length).toBe(3);
    component.toggle('SERVICE_1'); expect(component.line()[0].data).toEqual([0, null, 7]);
  });
  it('formats only for display and uses translated service names', () => {
    TestBed.inject(TranslateService).setTranslation('en', { guide: { statistics: { keys: { TOTAL: 'Total' } } } });
    TestBed.inject(TranslateService).use('en');
    expect(component.format(748.452380952)).toBe('748.5'); expect(component.label('TOTAL')).toBe('Total');
  });
});
