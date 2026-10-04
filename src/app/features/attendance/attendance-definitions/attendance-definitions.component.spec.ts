import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { AttendanceService } from '../attendance.service';
import { AttendanceGroupCountsResponse, AttendanceLogResponse, DefinitionDto } from '../attendance.model';
import { AttendanceDefinitionsComponent } from './attendance-definitions.component';

const KO = {
  attendance: {
    subtitle: '출석 정의 {{count}}개 · 활성 {{active}}개',
    definitions: '출석 정의',
    columns: { title: '제목', day: '요일', window: '체크인 시간', status: '상태', actions: '관리', group: '순', count: '출석 수', share: '비율', inPlace: '교회 안', outside: '교회 밖', unconfirmed: '미확인', name: '이름', worship: '예배', checkedInAt: '체크인 시간', location: '위치' },
    presence: { IN_PLACE: '교회 안', OUTSIDE: '교회 밖', UNCONFIRMED: '미확인' },
    unknownMember: '알 수 없는 교인',
    status: { active: '활성', inactive: '비활성' },
    days: { SUNDAY: '주일', WEDNESDAY: '수요일' },
    people: '{{count}}명',
    noGroup: '소속 순 없음',
    locationTotals: '합계 · {{totals}}.',
    unconfirmedHint: '미확인은 결석이 아닙니다.',
    deactivate: { accept: '비활성화' },
  },
};

const DEFS: DefinitionDto[] = [
  { publicId: 'd1', title: '주일 예배', dayOfWeek: 'SUNDAY', windowStart: '09:00:00', windowEnd: '10:30:00', isActive: true },
  { publicId: 'd2', title: '수요 예배', dayOfWeek: 'WEDNESDAY', windowStart: '19:30:00', windowEnd: '21:00:00', isActive: false },
];

const COUNTS: AttendanceGroupCountsResponse = {
  definitionPublicId: 'd1', definitionTitle: '주일 예배', attendanceDate: '2026-09-27', totalCount: 10,
  groups: [
    { groupPublicId: null, groupDivision: null, groupName: null, attendanceCount: 1 },
    { groupPublicId: 'g2', groupDivision: 'DANIEL', groupName: '2순', attendanceCount: 3 },
    { groupPublicId: 'g1', groupDivision: 'NEHEMIAH', groupName: '1순', attendanceCount: 6 },
  ],
} as AttendanceGroupCountsResponse;

function logOf(over: Partial<AttendanceLogResponse>): AttendanceLogResponse {
  return {
    logPublicId: 'l1', memberPublicId: 'm1', fullName: '홍길동', groupPublicId: 'g1', groupName: '1순',
    definitionPublicId: 'd1', definitionTitle: '주일 예배', checkedInAt: '2026-09-27T09:05:00', presence: 'IN_PLACE',
    ...over,
  };
}

const LOGS: AttendanceLogResponse[] = [
  logOf({}),
  logOf({ logPublicId: 'l2', fullName: 'Max Mustermann', groupPublicId: 'g2', groupName: '2순', presence: 'OUTSIDE' }),
  logOf({ logPublicId: 'l3', memberPublicId: null, fullName: null, groupPublicId: null, groupName: null, presence: 'UNCONFIRMED' }),
];

describe('AttendanceDefinitionsComponent', () => {
  let service: jasmine.SpyObj<AttendanceService>;
  let isPhone: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    service = jasmine.createSpyObj<AttendanceService>('AttendanceService', [
      'getDefinitions', 'getGroupCounts', 'deactivateDefinition', 'createDefinition', 'updateDefinition', 'getLogs',
    ]);
    service.getDefinitions.and.returnValue(of(DEFS));
    service.getGroupCounts.and.returnValue(of(COUNTS));
    service.getLogs.and.returnValue(of([]));
    isPhone = signal(false);

    TestBed.configureTestingModule({
      imports: [AttendanceDefinitionsComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: AttendanceService, useValue: service },
        { provide: BreakpointService, useValue: { isPhone } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');
  });

  function render() {
    const fixture = TestBed.createComponent(AttendanceDefinitionsComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows "출석 정의 N개 · 활성 M개" as subtitle', () => {
    expect(render().componentInstance.subtitle()).toBe('출석 정의 2개 · 활성 1개');
  });

  it('maps definitions to rows with 요일, "HH:mm – HH:mm" and 활성/비활성 badge', () => {
    const [sunday, wednesday] = render().componentInstance.records();
    expect(sunday.cells).toEqual({ title: '주일 예배', day: '주일', window: '09:00 – 10:30' });
    expect(sunday.badge).toEqual({ variant: 'active', label: '활성' });
    expect(wednesday.badge).toEqual({ variant: 'pending', label: '비활성' });
  });

  it('uses the Figma columns 제목, 요일, 체크인 시간, 상태, 관리', () => {
    expect(render().componentInstance.columns().map(c => c.header))
      .toEqual(['제목', '요일', '체크인 시간', '상태', '관리']);
  });

  it('opens the dialog empty for 추가 and filled for ✎', () => {
    const c = render().componentInstance;
    c.openAdd();
    expect(c.editing()).toBeNull();
    expect(c.dialogVisible()).toBeTrue();
    c.openEdit('d2');
    expect(c.editing()).toBe(DEFS[1]);
  });

  it('deactivates after confirm and reloads', () => {
    const fixture = render();
    const confirm = fixture.debugElement.injector.get(ConfirmationService);
    spyOn(confirm, 'confirm').and.callFake(opts => { opts.accept?.(); return confirm; });
    service.deactivateDefinition.and.returnValue(of(void 0));
    service.getDefinitions.calls.reset();

    fixture.componentInstance.confirmDeactivate('d1');

    expect(service.deactivateDefinition).toHaveBeenCalledWith('d1');
    expect(service.getDefinitions).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when deactivating fails', () => {
    const fixture = render();
    const confirm = fixture.debugElement.injector.get(ConfirmationService);
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(confirm, 'confirm').and.callFake(opts => { opts.accept?.(); return confirm; });
    spyOn(messages, 'add');
    service.deactivateDefinition.and.returnValue(throwError(() => new Error('500')));

    fixture.componentInstance.confirmDeactivate('d1');

    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
  });

  it('lists group counts most first, with division and 소속 순 없음', () => {
    const records = render().componentInstance.groupRecords();
    expect(records.map(r => r.title)).toEqual(['느헤미야 · 1순', '다니엘 · 2순', '소속 순 없음']);
    expect(records[0].cells?.['count']).toBe('6명');
    expect(records[0].cells?.['share']).toEqual({ value: 60, label: '60%' });
  });

  it('shows a dash for 교회 안/밖/미확인 when the server does not send them', () => {
    const c = render().componentInstance;
    const [first] = c.groupRecords();
    expect(first.cells?.['inPlace']).toBe('–');
    expect(first.subtitle).toBe('6명');
    expect(c.locationTotals()).toBeNull();
    expect(c.groupColumns().map(col => col.key)).toEqual(['group', 'count', 'inPlace', 'outside', 'unconfirmed', 'share']);
  });

  it('splits counts into 교회 안, 교회 밖 and 미확인 (never "absent")', () => {
    service.getGroupCounts.and.returnValue(of({
      ...COUNTS,
      totalInPlaceCount: 7, totalOutsideCount: 1, totalUnconfirmedCount: 2,
      groups: [{ ...COUNTS.groups[2], inPlaceCount: 4, outsideCount: 0, unconfirmedCount: 2 }],
    }));
    const fixture = render();
    const [g1] = fixture.componentInstance.groupRecords();
    expect(g1.cells?.['inPlace']).toBe('4명');
    expect(g1.cells?.['outside']).toBe('0명');
    expect(g1.cells?.['unconfirmed']).toBe('2명');
    expect(g1.cells?.['unconfirmedValue']).toBe(2);
    expect(g1.subtitle).toBe('6명 · 교회 안 4명 · 교회 밖 0명 · 미확인 2명');
    fixture.detectChanges();
    const note: HTMLElement = fixture.nativeElement.querySelector('[data-testid="location-totals"]');
    expect(note.textContent).toContain('합계 · 교회 안 7명 · 교회 밖 1명 · 미확인 2명.');
    expect(note.textContent).not.toContain('결석 2');
  });

  it('filters the list by the chosen chip and back to 전체', () => {
    const c = render().componentInstance;
    c.selectGroup('g2');
    expect(c.groupRecords().map(r => r.id)).toEqual(['g2']);
    c.selectGroup('g2');
    expect(c.groupRecords().length).toBe(3);
  });

  it('asks the counts for the selected definition and date', () => {
    const c = render().componentInstance;
    service.getGroupCounts.calls.reset();
    c.onDefinitionChange('d2');
    expect(service.getGroupCounts).toHaveBeenCalledWith(jasmine.objectContaining({ definitionId: 'd2' }));
  });

  it('maps the 체크인 명단 with 순 · time, 위치 badge and 알 수 없는 교인 for purged members', () => {
    service.getLogs.and.returnValue(of(LOGS));
    const [first, second, purged] = render().componentInstance.rosterRecords();
    expect(first.title).toBe('홍길동');
    expect(first.subtitle).toBe('1순 · 09:05');
    expect(first.meta).toBe('09:05');
    expect(first.cells).toEqual({ group: '1순', worship: '주일 예배' });
    expect(first.badge).toEqual({ variant: 'active', label: '교회 안' });
    expect(second.badge).toEqual({ variant: 'pending', label: '교회 밖' });
    expect(purged.title).toBe('알 수 없는 교인');
    expect(purged.cells?.['group']).toBe('소속 순 없음');
    expect(purged.badge).toEqual({ variant: 'neutral', label: '미확인' });
  });

  it('uses the roster columns 이름, 순, 예배, 체크인 시간, 위치', () => {
    expect(render().componentInstance.rosterColumns().map(c => c.header))
      .toEqual(['이름', '순', '예배', '체크인 시간', '위치']);
  });

  it('filters the roster by the same chip as the counts', () => {
    service.getLogs.and.returnValue(of(LOGS));
    const c = render().componentInstance;
    c.selectGroup('g2');
    expect(c.rosterRecords().map(r => r.title)).toEqual(['Max Mustermann']);
    c.selectGroup('none');
    expect(c.rosterRecords().map(r => r.title)).toEqual(['알 수 없는 교인']);
  });

  it('asks the roster for the selected definition and date', () => {
    const c = render().componentInstance;
    service.getLogs.calls.reset();
    c.onDefinitionChange('d2');
    expect(service.getLogs).toHaveBeenCalledWith(jasmine.objectContaining({ definitionId: 'd2' }));
  });

  it('shows an error toast and an empty roster when the roster fails', () => {
    service.getLogs.and.returnValue(throwError(() => new Error('403')));
    const fixture = TestBed.createComponent(AttendanceDefinitionsComponent);
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(messages, 'add');
    fixture.detectChanges();
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(fixture.componentInstance.rosterRecords()).toEqual([]);
  });

  it('renders list cards instead of the table on phone', () => {
    isPhone.set(true);
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelector('[data-testid="definitions-card"] app-data-table')).toBeNull();
    expect(el.querySelectorAll('[data-testid="definitions-card"] app-list-card').length).toBe(2);
  });
});
