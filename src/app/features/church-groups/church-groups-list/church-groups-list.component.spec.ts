import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { ChurchGroupSummary } from '../../../core/models/member.model';
import { RoleService } from '../../../core/services/role.service';
import { Breakpoint, BreakpointService } from '../../../core/ui/breakpoint.service';
import {
  ChurchGroupMatrix,
  ChurchGroupsService,
  DivisionKind,
  MemberCategory,
  TrainingMatrixMember,
  divisionKind,
} from '../church-groups.service';
import { ChurchGroupsListComponent } from './church-groups-list.component';

const KO = {
  groups: {
    title: '양육',
    subtitle: '{{groups}}개 순 · 청년 {{members}}명',
    all: '전체',
    stage: {
      'next-leader': '예비순장', discipleship: '제자반수료', 'one-on-one-completed': '일대일수료',
      'one-on-one-progress': '일대일진행', 'one-on-one-waiting': '일대일대기', qbs: '큐베세수료',
      unbaptized: '세례 확인대상', none: '미수료',
    },
    hint: { filter: '{{stage}} {{count}}명 강조', assign: '{{stage}} {{count}}명 강조 · 지정' },
    division: { NEHEMIA: '느헤미야', DANIEL: '다니엘', NEWCOMERS: '새가족순', none: '기타' },
    rowLabel: { group: '순', leader: '순장' },
    divisionSwitch: '구분',
    tableLabel: '양육 표',
    action: { assign: '{{name}} 지정', unassign: '{{name}} 해제' },
    empty: '등록된 순이 없습니다',
    error: {
      heading: '양육 명단을 불러오지 못했습니다',
      description: '잠시 후 다시 시도해 주세요.',
      retry: '다시 시도',
    },
    saveFailed: '저장 실패',
  },
};

/** Deliberately out of order: the page must still show 느헤미야, 다니엘, 새가족. */
const GROUPS: ChurchGroupSummary[] = [
  { publicId: 'nf', division: '', name: '새가족', leaderName: '백구현' },
  { publicId: 'g1', division: '다니엘', name: '온유', leaderName: '김유람' },
  { publicId: 'g2', division: '느헤미야', name: '믿음' },
];

/** Stage per member, before the 예비순장 flag is applied. */
const BASE: Record<string, MemberCategory> = {
  a: 'NEXT_LEADER', b: 'DISCIPLESHIP_COMPLETED', c: 'QBS_COMPLETED', d: 'DISCIPLESHIP_COMPLETED', e: 'DEFAULT',
};

const MEMBERS: TrainingMatrixMember[] = [
  { publicId: 'a', lastName: '김', firstName: '철수', baptism: null, groupPublicId: 'g1', isNextGroupLeader: true },
  { publicId: 'b', lastName: '이', firstName: '영희', baptism: null, groupPublicId: 'g1', isNextGroupLeader: false },
  { publicId: 'c', lastName: '박', firstName: '민수', baptism: null, groupPublicId: 'g1', isNextGroupLeader: false },
  { publicId: 'd', lastName: '최', firstName: '지우', baptism: null, groupPublicId: 'g2', isNextGroupLeader: false },
  { publicId: 'e', lastName: '정', firstName: '하은', baptism: null, groupPublicId: 'nf', isNextGroupLeader: false },
];

const RANK: Record<DivisionKind, number> = { NEHEMIA: 0, DANIEL: 1, OTHER: 2, NEWCOMERS: 3 };

/** A stand-in for buildMatrix: 예비순장 follows the flag, like the real stage rule. */
function fakeMatrix(members: TrainingMatrixMember[], groups: ChurchGroupSummary[]): ChurchGroupMatrix {
  const category = (m: TrainingMatrixMember): MemberCategory =>
    m.isNextGroupLeader ? 'NEXT_LEADER' : BASE[m.publicId] === 'NEXT_LEADER' ? 'DISCIPLESHIP_COMPLETED' : BASE[m.publicId];
  return {
    divisions: groups
      .map(g => ({
        key: divisionKind(g), kind: divisionKind(g), division: g.division ?? '',
        groups: [{
          publicId: g.publicId, division: g.division, name: g.name, leader: g.leaderName ?? '',
          members: members.filter(m => m.groupPublicId === g.publicId)
            .map(m => ({ publicId: m.publicId, displayName: m.lastName + m.firstName, category: category(m) })),
        }],
      }))
      .sort((x, y) => RANK[x.kind] - RANK[y.kind]),
    rowCount: 3,
  };
}

describe('ChurchGroupsListComponent', () => {
  let service: jasmine.SpyObj<ChurchGroupsService>;
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let canWrite: boolean;
  let breakpoint: ReturnType<typeof signal<Breakpoint>>;

  beforeEach(() => {
    canWrite = true;
    breakpoint = signal<Breakpoint>('desktop');
    service = jasmine.createSpyObj<ChurchGroupsService>('ChurchGroupsService', [
      'loadDashboardData', 'buildMatrix', 'setNextGroupLeader',
    ]);
    service.loadDashboardData.and.returnValue(of({ members: MEMBERS, groups: GROUPS }));
    service.buildMatrix.and.callFake(fakeMatrix);
    queryParamMap = new BehaviorSubject(convertToParamMap({}));

    TestBed.configureTestingModule({
      imports: [ChurchGroupsListComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: ChurchGroupsService, useValue: service },
        { provide: ActivatedRoute, useValue: { queryParamMap } },
        { provide: RoleService, useValue: { canWrite: () => canWrite } },
        { provide: BreakpointService, useValue: { current: breakpoint.asReadonly() } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');
  });

  function render(stage?: string) {
    if (stage) queryParamMap.next(convertToParamMap({ stage }));
    const fixture = TestBed.createComponent(ChurchGroupsListComponent);
    fixture.detectChanges();
    return fixture;
  }

  /** The cells of the column `groupId`, as [id, state, interactive]. */
  function cells(c: ChurchGroupsListComponent, groupId: string) {
    const column = c.divisions().flatMap(d => d.columns).find(col => col.key === groupId)!;
    return column.cells.map(cell => [cell.id, cell.state, cell.interactive]);
  }

  it('orders the blocks 느헤미야, 다니엘, 새가족순 without a 시니어/주니어 tag', () => {
    const c = render().componentInstance;
    expect(c.divisions().map(d => [d.heading, d.spanHeader])).toEqual([
      ['느헤미야', false],
      ['다니엘', false],
      ['새가족순', true],
    ]);
    expect(c.groupCount()).toBe(3);
    expect(c.totalMembers()).toBe(5);
  });

  it('counts every stage for the filter chips, zero included', () => {
    const chips = render().componentInstance.stageChips();
    expect(chips.map(ch => ch.stage)).toEqual([
      'next-leader', 'discipleship', 'one-on-one-completed', 'one-on-one-progress',
      'one-on-one-waiting', 'qbs', 'unbaptized', 'none',
    ]);
    expect(chips.find(ch => ch.stage === 'next-leader')).toEqual({ stage: 'next-leader', label: '예비순장', count: 1 });
    expect(chips.find(ch => ch.stage === 'discipleship')!.count).toBe(2);
    expect(chips.find(ch => ch.stage === 'one-on-one-completed')!.count).toBe(0);
  });

  it('shows every cell in its default state without a filter', () => {
    const c = render().componentInstance;
    expect(cells(c, 'g1')).toEqual([['a', 'default', false], ['b', 'default', false], ['c', 'default', false]]);
    expect(c.filterHint()).toBeNull();
  });

  it('marks the 순장 as 제자반수료 and leaves a group without one blank', () => {
    const c = render().componentInstance;
    const columns = c.divisions().flatMap(d => d.columns);
    expect(columns.find(col => col.key === 'g1')!.leader).toEqual(jasmine.objectContaining({
      label: '김유람', stage: 'discipleship', state: 'default', interactive: false,
    }));
    expect(columns.find(col => col.key === 'g2')!.leader).toBeNull();
  });

  it('greys out non-matching cells for a plain stage filter', () => {
    const c = render('qbs').componentInstance;
    expect(cells(c, 'g1')).toEqual([['a', 'dimmed', false], ['b', 'dimmed', false], ['c', 'default', false]]);
    expect(c.divisions().flatMap(d => d.columns).find(col => col.key === 'g1')!.leader!.state).toBe('dimmed');
    expect(c.filterHint()).toBe('큐베세수료 1명 강조');
  });

  it('keeps the 순장 highlighted under the 제자반수료 filter', () => {
    const c = render('discipleship').componentInstance;
    expect(c.divisions().flatMap(d => d.columns).find(col => col.key === 'g1')!.leader!.state).toBe('default');
  });

  it('turns 제자반수료 into clickable candidates while 예비순장 is active', () => {
    const c = render('next-leader').componentInstance;
    expect(cells(c, 'g1')).toEqual([['a', 'default', true], ['b', 'candidate', true], ['c', 'dimmed', false]]);
    expect(c.assignMode()).toBeTrue();
  });

  it('keeps 예비순장 a plain filter for a 양육 viewer (#214)', () => {
    canWrite = false;
    const c = render('next-leader').componentInstance;
    expect(c.assignMode()).toBeFalse();
    expect(cells(c, 'g1')).toEqual([['a', 'default', false], ['b', 'dimmed', false], ['c', 'dimmed', false]]);
    expect(c.filterHint()).toBe('예비순장 1명 강조');
    c.toggleNextLeader('b');
    expect(service.setNextGroupLeader).not.toHaveBeenCalled();
  });

  it('ignores an unknown ?stage=', () => {
    expect(render('bogus').componentInstance.stageFilter()).toBeNull();
  });

  it('writes the chosen stage to the URL and clears it on a second click', () => {
    const c = render('qbs').componentInstance;
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    c.selectStage('discipleship');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { stage: 'discipleship' } }));
    c.selectStage('qbs');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { stage: null } }));
  });

  it('assigns 예비순장 optimistically on a candidate click', () => {
    service.setNextGroupLeader.and.returnValue(of(void 0));
    const c = render('next-leader').componentInstance;
    const candidate = c.divisions().flatMap(d => d.columns).find(col => col.key === 'g1')!.cells[1];
    c.onCellActivated(candidate);
    expect(service.setNextGroupLeader).toHaveBeenCalledOnceWith('b', true);
    expect(c.stageChips().find(ch => ch.stage === 'next-leader')!.count).toBe(2);
  });

  it('does nothing on a cell click outside 예비순장 mode', () => {
    const c = render('qbs').componentInstance;
    c.onCellActivated({ id: 'b', label: '이영희', stage: 'discipleship', stageLabel: '제자반수료', state: 'dimmed', interactive: false });
    expect(service.setNextGroupLeader).not.toHaveBeenCalled();
  });

  it('reverts and shows a toast when saving fails', () => {
    service.setNextGroupLeader.and.returnValue(throwError(() => new Error('500')));
    const fixture = render('next-leader');
    const c = fixture.componentInstance;
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(messages, 'add');
    c.toggleNextLeader('a');
    expect(c.stageChips().find(ch => ch.stage === 'next-leader')!.count).toBe(1);
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', summary: '저장 실패' }));
  });

  it('ignores a second click while the 예비순장 PATCH is in flight (#254)', () => {
    const patch = new Subject<void>();
    service.setNextGroupLeader.and.returnValue(patch.asObservable());
    const fixture = render('next-leader');
    const c = fixture.componentInstance;
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(messages, 'add');
    const assigned = () => c.stageChips().find(ch => ch.stage === 'next-leader')!.count;

    c.toggleNextLeader('b');
    c.toggleNextLeader('b');
    expect(service.setNextGroupLeader).toHaveBeenCalledOnceWith('b', true);
    expect(assigned()).toBe(2);

    // The rollback restores the value the server still holds, not the flip of a flip.
    patch.error(new Error('500'));
    expect(assigned()).toBe(1);
    expect(messages.add).toHaveBeenCalledTimes(1);

    // Once the PATCH has settled the member can be clicked again.
    service.setNextGroupLeader.and.returnValue(of(void 0));
    c.toggleNextLeader('b');
    expect(service.setNextGroupLeader).toHaveBeenCalledTimes(2);
    expect(assigned()).toBe(2);
  });

  it('renders a write control for every candidate when the role may write (#254)', () => {
    const el: HTMLElement = render('next-leader').nativeElement;
    expect(el.querySelectorAll('[data-member]').length).toBe(5);
    // 예비순장 a plus the 제자반수료 candidates b and d.
    expect(el.querySelectorAll('[data-member] button').length).toBe(3);
  });

  it('renders no write control at all for a 양육 viewer (#214, #254)', () => {
    canWrite = false;
    const el: HTMLElement = render('next-leader').nativeElement;
    // Every member is still shown — a viewer gets no control, not a disabled one.
    expect(el.querySelectorAll('[data-member]').length).toBe(5);
    expect(el.querySelectorAll('[data-member] button').length).toBe(0);
  });

  it('renders one table with every division and no switch on desktop', () => {
    const el: HTMLElement = render('next-leader').nativeElement;
    expect(el.querySelectorAll('app-training-table').length).toBe(1);
    expect(el.querySelector('[data-testid="division-switch"]')).toBeNull();
    expect(el.querySelectorAll('[data-column]').length).toBe(3);
    expect(el.querySelector('[data-testid="filter-hint"]')!.textContent).toContain('예비순장 1명 강조');
    expect(el.querySelector('[data-stage="next-leader"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('[data-member="b"] button')!.getAttribute('aria-label')).toBe('이영희 지정');
  });

  it('shows one division at a time behind the switch on tablet', () => {
    breakpoint.set('tablet');
    const fixture = render();
    const c = fixture.componentInstance;
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="division-switch"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="stage-grid"]')).not.toBeNull();
    expect(c.divisionOptions().map(o => o.label)).toEqual(['느헤미야', '다니엘', '새가족순']);
    expect(c.visibleDivisions().map(d => d.key)).toEqual(['NEHEMIA']);
    c.selectedDivision.set('NEWCOMERS');
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-column]').length).toBe(1);
    expect(el.querySelector('[data-column="nf"]')).not.toBeNull();
  });

  it('keeps the switch labels on one line and lays the chips out 3 × 3 on phone', () => {
    breakpoint.set('phone');
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance.divisionOptions().map(o => o.label))
      .toEqual(['느헤미야', '다니엘', '새가족순']);
    expect(el.querySelector('[data-testid="stage-filter"]')!.className).toContain('grid-cols-3');
    expect(el.querySelectorAll('[data-testid="stage-filter"] > *').length).toBe(9);
  });

  it('shows the empty state when there are no groups', () => {
    service.loadDashboardData.and.returnValue(of({ members: [], groups: [] }));
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelector('app-empty-state h3')!.textContent).toContain('등록된 순이 없습니다');
    expect(el.querySelector('app-empty-state .pi-exclamation-triangle')).toBeNull();
  });

  it('offers a retry instead of the empty state when the load fails (#254)', () => {
    service.loadDashboardData.and.returnValue(throwError(() => new Error('403')));
    const fixture = render();
    const c = fixture.componentInstance;
    const el: HTMLElement = fixture.nativeElement;
    expect(c.failed()).toBeTrue();
    expect(el.querySelector('app-empty-state h3')!.textContent).toContain('양육 명단을 불러오지 못했습니다');
    expect(el.querySelector('app-empty-state .pi-exclamation-triangle')).not.toBeNull();
    expect(el.querySelector('app-training-table')).toBeNull();

    service.loadDashboardData.and.returnValue(of({ members: MEMBERS, groups: GROUPS }));
    el.querySelector<HTMLButtonElement>('app-empty-state button')!.click();
    fixture.detectChanges();
    expect(c.failed()).toBeFalse();
    expect(el.querySelectorAll('app-training-table').length).toBe(1);
  });
});
