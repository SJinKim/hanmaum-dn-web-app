import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { DashboardStats } from '../statistics.model';
import { StatisticsService } from '../statistics.service';
import { StatisticsDashboardComponent } from './statistics-dashboard.component';

const KO = {
  statistics: {
    title: '통계',
    period: { label: '기간', last30Days: '최근 30일', quarter: '분기', year: '연간' },
    empty: '데이터가 없습니다',
    yearLabel: '{{year}}년',
    thisWeek: '이번 주',
    lastWeek: '지난 주',
    people: '{{count}}명',
    trainingTotal: '전체 {{count}}명 · 단계별 현재 인원',
    charts: {
      growth: '성장 추이', gender: '성별 분포', attendanceRate: '출석률', trainingStages: '양육 단계 분포',
      services: '예배별 집계 · 이번 주', groupShare: '그룹별 출석 비율', ministries: '사역별 인원',
    },
  },
};

const STATS: DashboardStats = {
  totalMembers: 100, newMembersYtd: 12, averageAge: 27.4,
  cityDistribution: [], ageDistribution: [],
  genderDistribution: [{ label: '자매', value: 52 }, { label: '형제', value: 48 }],
  period: 'quarter',
  growthTrend: [
    { year: 2026, points: [{ label: '2026-07', value: 80 }, { label: '2026-08', value: 84 }] },
    {
      year: 2025,
      points: [{ label: '2025-07', value: 70 }, { label: '2025-08', value: 72 }, { label: '2025-09', value: 75 }],
    },
  ],
  attendanceRate: [{ label: '2026-07', value: 61.5 }, { label: '2026-08', value: 64 }],
  serviceAttendance: [
    { definitionPublicId: 'a1', title: '1부', windowStart: '07:30:00', thisWeek: 40, lastWeek: 36 },
    { definitionPublicId: 'a2', title: '2부', windowStart: '11:00:00', thisWeek: 90, lastWeek: 95 },
  ],
  divisionAttendance: [{ label: '다니엘', value: 30 }, { label: '느헤미야', value: 10 }],
  trainingStages: [
    { code: 'NEW', name: '새가족', count: 42 },
    { code: 'BASIC', name: '기초', count: 21 },
  ],
  ministryHeadcount: [{ label: '찬양팀', value: 12 }],
};

describe('StatisticsDashboardComponent', () => {
  let service: jasmine.SpyObj<StatisticsService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<StatisticsService>('StatisticsService', ['getDashboard']);
    service.getDashboard.and.returnValue(of(STATS));

    TestBed.configureTestingModule({
      imports: [StatisticsDashboardComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: StatisticsService, useValue: service },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');
  });

  function render() {
    const fixture = TestBed.createComponent(StatisticsDashboardComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('labels the gender donut with its share, as the Figma legend does', () => {
    const c = render().componentInstance;
    expect(c.genderLabels()).toEqual(['자매 52 %', '형제 48 %']);
    expect(c.genderSeries()[0].data).toEqual([52, 48]);
  });

  it('leaves the gender donut empty when every count is 0', () => {
    service.getDashboard.and.returnValue(of({
      ...STATS, genderDistribution: [{ label: '자매', value: 0 }],
    }));
    expect(render().componentInstance.genderSeries()).toEqual([]);
  });

  it('stops loading when the dashboard fails', () => {
    service.getDashboard.and.returnValue(throwError(() => new Error('500')));
    const c = render().componentInstance;
    expect(c.loading()).toBeFalse();
    expect(c.stats()).toBeNull();
  });

  it('renders all seven Figma charts in their order', () => {
    const el: HTMLElement = render().nativeElement;
    const charts = Array.from(el.querySelectorAll('[data-chart]')).map(n => n.getAttribute('data-chart'));
    expect(charts).toEqual([
      'growth', 'gender', 'attendanceRate', 'trainingStages', 'services', 'groupShare', 'ministries',
    ]);
  });

  it('loads the quarter first and reloads when the period changes', () => {
    const fixture = render();
    expect(service.getDashboard).toHaveBeenCalledOnceWith('quarter');
    fixture.componentInstance.onPeriodChange('30d');
    fixture.detectChanges();
    expect(service.getDashboard).toHaveBeenCalledWith('30d');
    expect(fixture.componentInstance.periodOptions().map(o => o.label)).toEqual(['최근 30일', '분기', '연간']);
  });

  it('ignores an unknown period', () => {
    const fixture = render();
    fixture.componentInstance.onPeriodChange('week');
    fixture.detectChanges();
    expect(service.getDashboard).toHaveBeenCalledTimes(1);
  });

  it('draws one growth line per year on the longest axis', () => {
    const c = render().componentInstance;
    expect(c.growthLabels()).toEqual(['7월', '8월', '9월']);
    expect(c.growthSeries().map(s => s.label)).toEqual(['2026년', '2025년']);
    expect(c.growthSeries()[0].data).toEqual([80, 84]);
  });

  it('labels day buckets with month and day', () => {
    service.getDashboard.and.returnValue(of({ ...STATS, attendanceRate: [{ label: '2026-10-07', value: 50 }] }));
    expect(render().componentInstance.attendanceLabels()).toEqual(['10. 7.']);
  });

  it('labels services with their start time and pairs this week with last week', () => {
    const c = render().componentInstance;
    expect(c.serviceLabels()).toEqual(['1부 · 07:30', '2부 · 11:00']);
    expect(c.serviceSeries().map(s => s.label)).toEqual(['이번 주', '지난 주']);
    expect(c.serviceSeries()[1].data).toEqual([36, 95]);
  });

  it('labels the group donut with count and share', () => {
    expect(render().componentInstance.divisionLabels()).toEqual(['다니엘 30명 · 75 %', '느헤미야 10명 · 25 %']);
  });

  it('lists the training stages as bars relative to the largest, with the total', () => {
    const el: HTMLElement = render().nativeElement;
    const rows = el.querySelectorAll('[data-testid="training-stage"]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('42명');
    expect(el.querySelector('[data-testid="training-total"]')?.textContent).toContain('전체 63명');
  });

  it('shows the empty state when there are no training stages', () => {
    service.getDashboard.and.returnValue(of({ ...STATS, trainingStages: [] }));
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelector('[data-chart="trainingStages"] app-empty-state')).not.toBeNull();
  });
});
