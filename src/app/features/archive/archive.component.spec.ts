import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { MemberSummary } from '../../core/models/member.model';
import { TrainingCatalogEntry } from '../../core/models/member-activity.model';
import { BreakpointService } from '../../core/ui/breakpoint.service';
import { ActiveMinistryMemberDto, MinistrySummary } from '../ministry/ministry.model';
import { ArchiveComponent, formatYearMonth } from './archive.component';
import { ArchiveService, MinistryArchive, TrainingArchive } from './archive.service';

const KO = {
  archive: {
    tabs: { training: '양육', ministry: '사역' },
    columns: { name: '이름', group: '순', status: '상태', role: '역할', startDate: '시작일', endDate: '종료일' },
    status: { active: '활동', graduated: '졸업' },
    trainingHeading: '{{name}} · 수료 {{count}}명',
    ministryHeading: '{{name}} · 지난 팀원 {{count}}명',
    empty: { training: '아직 수료한 청년이 없습니다', ministry: '아직 지난 팀원이 없습니다' },
    error: '기록을 불러오지 못했습니다',
  },
  ministry: { detail: { roles: { LEADER: '팀장', SUB_LEADER: '부팀장', MEMBER: '팀원' } } },
};

const entry = (code: string, nameKo: string, sortOrder: number): TrainingCatalogEntry => ({
  publicId: code, code, name: code, nameKo, category: null, sortOrder,
  hasCohorts: false, isActive: true, prerequisiteCode: null,
});

const member = (id: string, patch: Partial<MemberSummary> = {}): MemberSummary => ({
  publicId: id, lastName: '김', firstName: id, email: null, memberStatus: 'ACTIVE',
  baptism: null, groupName: '1순', ...patch,
});

const TRAININGS: TrainingArchive[] = [
  { entry: entry('ONE', '일대일', 1), members: [member('a'), member('b', { memberStatus: 'INACTIVE', groupName: null })] },
  { entry: entry('QBS', '큐베세', 2), members: [] },
];

const MINISTRY: MinistrySummary = { publicId: 'm1', title: '찬양팀' } as MinistrySummary;
const MINISTRIES: MinistryArchive[] = [{
  ministry: MINISTRY,
  members: [{ publicId: 'a', fullName: '김a', startDate: '2023-03-01', endDate: '2025-12-31', role: 'LEADER' } as ActiveMinistryMemberDto],
}];

describe('ArchiveComponent', () => {
  let service: jasmine.SpyObj<ArchiveService>;
  let isPhone: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    service = jasmine.createSpyObj<ArchiveService>('ArchiveService', ['loadTrainingArchive', 'loadMinistryArchive']);
    service.loadTrainingArchive.and.returnValue(of(TRAININGS));
    service.loadMinistryArchive.and.returnValue(of(MINISTRIES));
    isPhone = signal(false);

    TestBed.configureTestingModule({
      imports: [ArchiveComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: ArchiveService, useValue: service },
        { provide: BreakpointService, useValue: { isPhone } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');
  });

  function render() {
    const fixture = TestBed.createComponent(ArchiveComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows one 양육 card per course with graduates, empty courses left out', () => {
    const sections = render().componentInstance.trainingSections();
    expect(sections.map(s => s.heading)).toEqual(['일대일 · 수료 2명']);
  });

  it('maps 순 and 활동/졸업 onto the 양육 rows', () => {
    const [a, b] = render().componentInstance.trainingSections()[0].records;
    expect(a.subtitle).toBe('1순');
    expect(a.badge).toEqual({ variant: 'active', label: '활동' });
    expect(b.subtitle).toBe('—');
    expect(b.badge).toEqual({ variant: 'inactive', label: '졸업' });
  });

  it('switches to 사역 with 역할, 시작일 and 종료일 as YY.MM', () => {
    const c = render().componentInstance;
    c.tab.set('ministry');
    const [section] = c.sections();
    expect(section.heading).toBe('찬양팀 · 지난 팀원 1명');
    expect(section.records[0]).toEqual(jasmine.objectContaining({ subtitle: '팀장', meta: '23.03' }));
    expect(section.records[0].cells?.['endDate']).toBe('25.12');
    expect(c.columns().map(col => col.header)).toEqual(['이름', '역할', '시작일', '종료일']);
  });

  it('shows an empty state when a tab has no rows', () => {
    service.loadMinistryArchive.and.returnValue(of([]));
    const fixture = render();
    fixture.componentInstance.tab.set('ministry');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('아직 지난 팀원이 없습니다');
  });

  it('shows the error state when loading fails', () => {
    service.loadTrainingArchive.and.returnValue(throwError(() => new Error('500')));
    const fixture = render();
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('기록을 불러오지 못했습니다');
  });

  it('renders list cards instead of the table on phone', () => {
    isPhone.set(true);
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelector('[data-testid="archive-card"] app-data-table')).toBeNull();
    expect(el.querySelectorAll('[data-testid="archive-card"] app-list-card').length).toBe(2);
  });

  it('formats dates as YY.MM', () => {
    expect(formatYearMonth('2024-07-15')).toBe('24.07');
    expect(formatYearMonth(null)).toBe('—');
  });
});
