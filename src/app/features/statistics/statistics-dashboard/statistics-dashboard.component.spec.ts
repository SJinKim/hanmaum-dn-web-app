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
    pendingBanner: '일부 집계는 서버에서 준비 중입니다',
    pendingEmpty: { heading: '집계 준비 중', description: '서버 집계가 준비되면 여기에 표시됩니다' },
    empty: '데이터가 없습니다',
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

  it('shows the period switch as inert, since the endpoint takes no period', () => {
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelector('[data-testid="period"]')?.hasAttribute('inert')).toBeTrue();
    expect(render().componentInstance.periodOptions().map(o => o.label)).toEqual(['최근 30일', '분기', '연간']);
  });

  it('shows the pending banner', () => {
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelector('[data-testid="pending-banner"]')?.textContent).toContain('준비 중');
  });
});
