import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { ChurchGroupSummary, MemberSummary } from '../../../core/models/member.model';
import { ChurchGroupMatrix, ChurchGroupsService, MemberCategory } from '../church-groups.service';
import { ChurchGroupsListComponent } from './church-groups-list.component';

const KO = {
  groups: {
    title: '순',
    subtitle: '{{groups}}개 순 · 청년 {{members}}명',
    all: '전체', collapseAll: '모두 접기', expandAll: '모두 펼치기',
    stage: {
      'next-leader': '예비순장', discipleship: '제자반수료', 'one-on-one-completed': '일대일수료',
      'one-on-one-progress': '일대일진행', 'one-on-one-waiting': '일대일대기', qbs: '큐베세수료',
      unbaptized: '세례 확인대상', none: '미수료',
    },
    hint: { filter: '{{stage}} {{count}}명 강조', assign: '{{stage}} {{count}}명 강조 · 지정' },
    division: { DANIEL: '다니엘', NEHEMIA: '느헤미야' },
    divisionHeading: '{{name}} 그룹',
    divisionCaption: '{{groups}}개 순 · {{members}}명',
    saveFailed: '저장 실패',
  },
};

const GROUPS: ChurchGroupSummary[] = [
  { publicId: 'g1', division: 'DANIEL', name: '온유' },
  { publicId: 'g2', division: 'NEHEMIA', name: '믿음' },
];

/** Stage per member, before the 예비순장 flag is applied. */
const BASE: Record<string, MemberCategory> = {
  a: 'NEXT_LEADER', b: 'DISCIPLESHIP_COMPLETED', c: 'QBS_COMPLETED', d: 'DISCIPLESHIP_COMPLETED',
};

const MEMBERS = [
  { publicId: 'a', lastName: '김', firstName: '철수', groupPublicId: 'g1', isNextGroupLeader: true },
  { publicId: 'b', lastName: '이', firstName: '영희', groupPublicId: 'g1', isNextGroupLeader: false },
  { publicId: 'c', lastName: '박', firstName: '민수', groupPublicId: 'g1', isNextGroupLeader: false },
  { publicId: 'd', lastName: '최', firstName: '지우', groupPublicId: 'g2', isNextGroupLeader: false },
] as unknown as MemberSummary[];

/** A stand-in for buildMatrix: 예비순장 follows the flag, like the real stage rule. */
function fakeMatrix(members: MemberSummary[], groups: ChurchGroupSummary[]): ChurchGroupMatrix {
  const category = (m: MemberSummary): MemberCategory =>
    m.isNextGroupLeader ? 'NEXT_LEADER' : BASE[m.publicId] === 'NEXT_LEADER' ? 'DISCIPLESHIP_COMPLETED' : BASE[m.publicId];
  return {
    divisions: groups.map(g => ({
      division: g.division!,
      groups: [{
        publicId: g.publicId, division: g.division, name: g.name, leader: '',
        members: members.filter(m => m.groupPublicId === g.publicId)
          .map(m => ({ publicId: m.publicId, displayName: m.lastName + m.firstName, category: category(m) })),
      }],
    })),
    rowCount: 3,
  };
}

describe('ChurchGroupsListComponent', () => {
  let service: jasmine.SpyObj<ChurchGroupsService>;
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    service = jasmine.createSpyObj<ChurchGroupsService>('ChurchGroupsService', [
      'loadDashboardData', 'buildMatrix', 'patchMemberFlags',
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

  it('shows one section per division with "{name} 그룹" and its count', () => {
    const c = render().componentInstance;
    expect(c.divisions().map(d => [d.heading, d.caption])).toEqual([
      ['다니엘 그룹', '1개 순 · 3명'],
      ['느헤미야 그룹', '1개 순 · 1명'],
    ]);
    expect(c.groupCount()).toBe(2);
    expect(c.totalMembers()).toBe(4);
  });

  it('counts every stage for the filter chips, zero included', () => {
    const chips = render().componentInstance.stageChips();
    expect(chips.map(ch => ch.stage)).toEqual([
      'next-leader', 'discipleship', 'one-on-one-completed', 'one-on-one-progress',
      'one-on-one-waiting', 'qbs', 'unbaptized', 'none',
    ]);
    expect(chips.find(ch => ch.stage === 'next-leader')).toEqual({ stage: 'next-leader', label: '예비순장', count: 1 });
    expect(chips.find(ch => ch.stage === 'discipleship')!.count).toBe(2);
    expect(chips.find(ch => ch.stage === 'none')!.count).toBe(0);
  });

  it('renders every pill in its default state without a filter', () => {
    const c = render().componentInstance;
    const members = c.divisions()[0].cards[0].members;
    expect(members.every(m => !m.state && !m.interactive)).toBeTrue();
    expect(c.divisions()[0].cards[0].matchCount).toBeUndefined();
    expect(c.filterHint()).toBeNull();
  });

  it('dims non-matching pills and counts matches for a plain stage filter', () => {
    const c = render('qbs').componentInstance;
    const card = c.divisions()[0].cards[0];
    expect(card.members.map(m => [m.id, m.state])).toEqual([
      ['a', 'dimmed'], ['b', 'dimmed'], ['c', undefined],
    ]);
    expect(card.members.some(m => m.interactive)).toBeFalse();
    expect(card.matchCount).toBe(1);
    expect(c.filterHint()).toBe('큐베세수료 1명 강조');
  });

  it('turns 제자반수료 into clickable candidates while 예비순장 is active', () => {
    const c = render('next-leader').componentInstance;
    const card = c.divisions()[0].cards[0];
    expect(card.members.map(m => [m.id, m.state, m.interactive])).toEqual([
      ['a', undefined, true], ['b', 'candidate', true], ['c', 'dimmed', undefined],
    ]);
    expect(c.assignMode()).toBeTrue();
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
    service.patchMemberFlags.and.returnValue(of(void 0));
    const c = render('next-leader').componentInstance;
    c.onMemberClicked(c.divisions()[0].cards[0].members[1]);
    expect(service.patchMemberFlags).toHaveBeenCalledOnceWith('b', { isNextGroupLeader: true });
    expect(c.stageChips().find(ch => ch.stage === 'next-leader')!.count).toBe(2);
  });

  it('does nothing on a pill click outside 예비순장 mode', () => {
    const c = render('qbs').componentInstance;
    c.onMemberClicked({ id: 'b', label: '이영희', stage: 'discipleship', stageLabel: '제자반수료' });
    expect(service.patchMemberFlags).not.toHaveBeenCalled();
  });

  it('reverts and shows a toast when saving fails', () => {
    service.patchMemberFlags.and.returnValue(throwError(() => new Error('500')));
    const fixture = render('next-leader');
    const c = fixture.componentInstance;
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(messages, 'add');
    c.toggleNextLeader('a');
    expect(c.stageChips().find(ch => ch.stage === 'next-leader')!.count).toBe(1);
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', summary: '저장 실패' }));
  });

  it('collapses and expands every card at once', () => {
    const c = render().componentInstance;
    expect(c.isExpanded('g1')).toBeTrue();
    c.toggleAll();
    expect(c.allCollapsed()).toBeTrue();
    expect(c.isExpanded('g2')).toBeFalse();
    c.toggleAll();
    expect(c.isExpanded('g2')).toBeTrue();
  });

  it('renders one GroupCard per 순 and the hint when filtered', () => {
    const el: HTMLElement = render('next-leader').nativeElement;
    expect(el.querySelectorAll('app-group-card').length).toBe(2);
    expect(el.querySelector('[data-testid="filter-hint"]')!.textContent).toContain('예비순장 1명 강조');
    expect(el.querySelector('[data-stage="next-leader"]')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the empty state when there are no groups', () => {
    service.loadDashboardData.and.returnValue(of({ members: [], groups: [] }));
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelector('app-empty-state')).not.toBeNull();
  });
});
