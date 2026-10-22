import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ChurchGroupsService } from './church-groups.service';
import { MemberSummary, ChurchGroupSummary } from '../../core/models/member.model';
import { TrainingCatalogEntry } from '../../core/models/member-activity.model';
import { TrainingCatalogService } from '../../core/services/training-catalog.service';

function entry(code: string, name: string, sortOrder: number): TrainingCatalogEntry {
  return {
    publicId: `p-${code}`, code, name, nameKo: `${code}-ko`,
    category: null, sortOrder, hasCohorts: false, isActive: true, prerequisiteCode: null,
  };
}

/** The post-migration catalog: English long names, stable codes. */
const CATALOG: TrainingCatalogEntry[] = [
  entry('QT_BASIC_SEMINAR', 'Quiet Time Basic Seminar', 1),
  entry('ONE_ON_ONE', 'One-to-One Discipleship Training', 2),
  entry('YOUTH_POWER_DISCIPLESHIP', 'Youth Power Discipleship Class', 3),
];

const QTBS = 'Quiet Time Basic Seminar';
const ONE_ON_ONE = 'One-to-One Discipleship Training';
const DISCIPLESHIP = 'Youth Power Discipleship Class';

function makeMember(overrides: Partial<MemberSummary> = {}): MemberSummary {
  return {
    publicId: 'pub-1',
    lastName: '김',
    firstName: '철수',
    email: null,
    memberStatus: 'ACTIVE',
    baptism: 'GENERAL_BAPTIZED',
    groupName: null,
    ...overrides,
  };
}

describe('ChurchGroupsService', () => {
  let service: ChurchGroupsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ fallbackLang: 'en' }),
      ],
    });
    TestBed.inject(TrainingCatalogService).entries.set(CATALOG);
    service = TestBed.inject(ChurchGroupsService);
  });

  describe('computeCategory', () => {
    it('returns NEXT_LEADER when isNextGroupLeader is true', () => {
      expect(service.computeCategory(makeMember({ isNextGroupLeader: true }))).toBe('NEXT_LEADER');
    });

    it('NEXT_LEADER overrides any training status', () => {
      const m = makeMember({
        isNextGroupLeader: true,
        trainings: [{ name: ONE_ON_ONE, status: 'IN_PROGRESS' }],
      });
      expect(service.computeCategory(m)).toBe('NEXT_LEADER');
    });

    it('returns ONE_ON_ONE_IN_PROGRESS when 1on1 is IN_PROGRESS', () => {
      const m = makeMember({ trainings: [{ name: ONE_ON_ONE, status: 'IN_PROGRESS' }] });
      expect(service.computeCategory(m)).toBe('ONE_ON_ONE_IN_PROGRESS');
    });

    it('returns ONE_ON_ONE_WAITING when QTBS COMPLETED and signup filled', () => {
      const m = makeMember({
        trainings: [{ name: QTBS, status: 'COMPLETED' }],
        oneOnOneSignupFilled: true,
      });
      expect(service.computeCategory(m)).toBe('ONE_ON_ONE_WAITING');
    });

    it('returns QBS_COMPLETED when QTBS COMPLETED but signup NOT filled', () => {
      const m = makeMember({
        trainings: [{ name: QTBS, status: 'COMPLETED' }],
        oneOnOneSignupFilled: false,
      });
      expect(service.computeCategory(m)).toBe('QBS_COMPLETED');
    });

    it('returns DISCIPLESHIP_COMPLETED when Discipleship COMPLETED', () => {
      const m = makeMember({ trainings: [{ name: DISCIPLESHIP, status: 'COMPLETED' }] });
      expect(service.computeCategory(m)).toBe('DISCIPLESHIP_COMPLETED');
    });

    it('a completed 일대일 is not mistaken for 제자반 despite the shared "Discipleship" name', () => {
      // "One-to-One Discipleship Training" contains "Discipleship", so a substring
      // match would wrongly report 제자반수료 here.
      const m = makeMember({ trainings: [{ name: ONE_ON_ONE, status: 'COMPLETED' }] });
      expect(service.computeCategory(m)).toBe('ONE_ON_ONE_COMPLETED');
    });

    it('DISCIPLESHIP_COMPLETED beats QBS_COMPLETED even though QTBS is also completed', () => {
      const m = makeMember({
        trainings: [
          { name: QTBS, status: 'COMPLETED' },
          { name: ONE_ON_ONE, status: 'COMPLETED' },
          { name: DISCIPLESHIP, status: 'COMPLETED' },
        ],
      });
      expect(service.computeCategory(m)).toBe('DISCIPLESHIP_COMPLETED');
    });

    it('returns ONE_ON_ONE_COMPLETED when 1on1 is COMPLETED', () => {
      const m = makeMember({ trainings: [{ name: ONE_ON_ONE, status: 'COMPLETED' }] });
      expect(service.computeCategory(m)).toBe('ONE_ON_ONE_COMPLETED');
    });

    it('returns ONE_ON_ONE_COMPLETED when Discipleship is IN_PROGRESS (1on1 already done)', () => {
      const m = makeMember({
        trainings: [
          { name: QTBS, status: 'COMPLETED' },
          { name: ONE_ON_ONE, status: 'COMPLETED' },
          { name: DISCIPLESHIP, status: 'IN_PROGRESS' },
        ],
      });
      expect(service.computeCategory(m)).toBe('ONE_ON_ONE_COMPLETED');
    });

    it('returns UNBAPTIZED when baptism is null', () => {
      expect(service.computeCategory(makeMember({ baptism: null }))).toBe('UNBAPTIZED');
    });

    it('returns UNBAPTIZED when baptism is UNBAPTIZED', () => {
      expect(service.computeCategory(makeMember({ baptism: 'UNBAPTIZED' }))).toBe('UNBAPTIZED');
    });

    it('returns DEFAULT when baptized and no matching trainings', () => {
      expect(service.computeCategory(makeMember({ baptism: 'GENERAL_BAPTIZED' }))).toBe('DEFAULT');
    });

    it('QTBS IN_PROGRESS does not trigger QBS_COMPLETED', () => {
      const m = makeMember({ trainings: [{ name: QTBS, status: 'IN_PROGRESS' }] });
      expect(service.computeCategory(m)).not.toBe('QBS_COMPLETED');
    });
  });

  describe('computeCategory with an empty catalog', () => {
    // The catalog is its own request. While `/v1/trainings/catalog` was
    // ADMIN-only a 양육 role got a 403 there and the matrix was built with an
    // empty catalog (#214) — the stages are keyed on catalog codes, so every
    // training match silently missed. The endpoint is TRAINING_READ now; the
    // degradation is pinned here so a regression shows up as a failing spec
    // and not as a table that quietly reports the wrong stage.
    beforeEach(() => TestBed.inject(TrainingCatalogService).entries.set([]));

    it('keeps the stages that come from a flag', () => {
      expect(service.computeCategory(makeMember({ isNextGroupLeader: true }))).toBe('NEXT_LEADER');
      expect(service.computeCategory(makeMember({ baptism: 'UNBAPTIZED' }))).toBe('UNBAPTIZED');
    });

    it('cannot tell a completed 제자반 from nothing at all', () => {
      const m = makeMember({ trainings: [{ name: DISCIPLESHIP, status: 'COMPLETED' }] });
      expect(service.computeCategory(m)).toBe('DEFAULT');
    });

    it('still builds a matrix, so the table renders rather than breaking', () => {
      const groups: ChurchGroupSummary[] = [{ publicId: 'g1', division: '느헤미야', name: '믿음' }];
      const matrix = service.buildMatrix(
        [makeMember({ publicId: 'm1', groupPublicId: 'g1', trainings: [{ name: QTBS, status: 'COMPLETED' }] })],
        groups,
      );
      expect(matrix.divisions[0].groups[0].members).toEqual([
        { publicId: 'm1', displayName: '김철수', category: 'DEFAULT' },
      ]);
    });
  });

  describe('buildMatrix', () => {
    const group1: ChurchGroupSummary = { publicId: 'g1', division: '느헤미야', name: '믿음' };
    const group2: ChurchGroupSummary = { publicId: 'g2', division: '느헤미야', name: '소망' };
    const group3: ChurchGroupSummary = { publicId: 'g3', division: '다니엘', name: '온유' };
    const newFamily: ChurchGroupSummary = { publicId: 'nf', division: '새가족', name: '새가족' };

    it('returns rowCount 0 and empty columns when no members', () => {
      const m = service.buildMatrix([], [group1]);
      expect(m.rowCount).toBe(0);
      expect(m.divisions.length).toBe(1);
      expect(m.divisions[0].groups[0].members).toEqual([]);
    });

    it('groups columns by division in stable order', () => {
      const m = service.buildMatrix([], [group1, group2, group3]);
      expect(m.divisions.map(d => d.division)).toEqual(['느헤미야', '다니엘']);
      expect(m.divisions[0].groups.map(g => g.name)).toEqual(['믿음', '소망']);
      expect(m.divisions[1].groups.map(g => g.name)).toEqual(['온유']);
    });

    it('orders 느헤미야 before 다니엘 regardless of input order (#234)', () => {
      const daniel: ChurchGroupSummary = { publicId: 'd1', division: '다니엘', name: '온유' };
      const nehemia: ChurchGroupSummary = { publicId: 'n1', division: '느헤미야', name: '믿음' };
      const m = service.buildMatrix([], [daniel, nehemia]);
      expect(m.divisions.map(d => d.kind)).toEqual(['NEHEMIA', 'DANIEL']);
    });

    it('recognises the division codes as well as the Korean names', () => {
      const daniel: ChurchGroupSummary = { publicId: 'd1', division: 'DANIEL', name: '온유' };
      const nehemia: ChurchGroupSummary = { publicId: 'n1', division: 'NEHEMIA', name: '믿음' };
      const m = service.buildMatrix([], [daniel, nehemia]);
      expect(m.divisions.map(d => [d.kind, d.division])).toEqual([['NEHEMIA', 'NEHEMIA'], ['DANIEL', 'DANIEL']]);
    });

    it('puts an unknown division after 다니엘 and before 새가족', () => {
      const other: ChurchGroupSummary = { publicId: 'o1', division: '청년부', name: '기쁨' };
      const m = service.buildMatrix([], [newFamily, other, group3, group1]);
      expect(m.divisions.map(d => d.key)).toEqual(['NEHEMIA', 'DANIEL', 'OTHER:청년부', 'NEWCOMERS']);
    });

    it('treats the 새가족 group as 새가족 even with an empty division', () => {
      const bare: ChurchGroupSummary = { publicId: 'nf', division: '', name: '새가족' };
      const m = service.buildMatrix([], [bare, group1]);
      expect(m.divisions.map(d => d.kind)).toEqual(['NEHEMIA', 'NEWCOMERS']);
    });

    it('renders the 새가족 group as an ordinary table-driven column', () => {
      const member = makeMember({ publicId: 'x', groupPublicId: 'nf' });
      const m = service.buildMatrix([member], [group1, newFamily]);
      expect(m.divisions.map(d => d.division)).toEqual(['느헤미야', '새가족']);
      const newFamilyCol = m.divisions
        .flatMap(d => d.groups)
        .find(g => g.name === '새가족');
      expect(newFamilyCol).toBeDefined();
      expect(newFamilyCol!.members.map(c => c.publicId)).toEqual(['x']);
    });

    it('sorts the 새가족 division last regardless of input order', () => {
      const daniel: ChurchGroupSummary = { publicId: 'd1', division: 'DANIEL', name: '온유' };
      const nehemia: ChurchGroupSummary = { publicId: 'n1', division: 'NEHEMIA', name: '믿음' };
      const m = service.buildMatrix([], [newFamily, daniel, nehemia]);
      expect(m.divisions.map(d => d.division)).toEqual(['NEHEMIA', 'DANIEL', '새가족']);
    });

    it('places members in the correct group column', () => {
      const member = makeMember({ groupPublicId: 'g1' });
      const m = service.buildMatrix([member], [group1, group2]);
      expect(m.divisions[0].groups[0].members.length).toBe(1);
      expect(m.divisions[0].groups[1].members.length).toBe(0);
    });

    it('rowCount equals the largest column size', () => {
      const members = [
        makeMember({ publicId: 'a', groupPublicId: 'g1' }),
        makeMember({ publicId: 'b', groupPublicId: 'g1' }),
        makeMember({ publicId: 'c', groupPublicId: 'g2' }),
      ];
      const m = service.buildMatrix(members, [group1, group2]);
      expect(m.rowCount).toBe(2);
    });

    it('folds members with no groupPublicId into the 새가족 column (safety net)', () => {
      const members = [
        makeMember({ publicId: 'a', groupPublicId: null }),
        makeMember({ publicId: 'b', groupPublicId: null }),
      ];
      const m = service.buildMatrix(members, [group1, newFamily]);
      const newFamilyCol = m.divisions.flatMap(d => d.groups).find(g => g.name === '새가족');
      expect(newFamilyCol!.members.map(c => c.publicId)).toEqual(['a', 'b']);
      expect(m.divisions[0].groups[0].members.length).toBe(0);
      expect(m.rowCount).toBe(2);
    });

    it('drops group-less members when no 새가족 column exists', () => {
      const member = makeMember({ groupPublicId: null });
      const m = service.buildMatrix([member], [group1]);
      expect(m.divisions[0].groups[0].members.length).toBe(0);
      expect(m.rowCount).toBe(0);
    });

    it('resolves the 순장 leader name from the group summary', () => {
      const led: ChurchGroupSummary = { ...group1, leaderPublicId: 'L', leaderName: '서준' };
      const m = service.buildMatrix([], [led]);
      expect(m.divisions[0].groups[0].leader).toBe('서준');
    });

    it('falls back to the member flagged isGroupLeader when the group has no leaderName', () => {
      const leader = makeMember({ publicId: 'L', groupPublicId: 'g1', lastName: '서', firstName: '준', isGroupLeader: true });
      const m = service.buildMatrix([leader], [group1]);
      expect(m.divisions[0].groups[0].leader).toBe('서준');
    });

    it('omits the 순장 from the group body cells', () => {
      const leader = makeMember({ publicId: 'L', groupPublicId: 'g1', lastName: '서', firstName: '준', isGroupLeader: true });
      const member = makeMember({ publicId: 'x', groupPublicId: 'g1', lastName: '김', firstName: '철수' });
      const m = service.buildMatrix([leader, member], [group1]);
      expect(m.divisions[0].groups[0].members.map(c => c.publicId)).toEqual(['x']);
      expect(m.rowCount).toBe(1);
    });

    it('ignores churchRole when resolving the 순장', () => {
      const member = makeMember({ publicId: 'x', groupPublicId: 'g1', lastName: '이', firstName: '영희', churchRole: '순장' });
      const m = service.buildMatrix([member], [group1]);
      expect(m.divisions[0].groups[0].leader).toBe('');
      expect(m.divisions[0].groups[0].members.length).toBe(1);
    });

    it('leader is empty string when no 순장 in the group', () => {
      const member = makeMember({ publicId: 'x', groupPublicId: 'g1', churchRole: null });
      const m = service.buildMatrix([member], [group1]);
      expect(m.divisions[0].groups[0].leader).toBe('');
    });

    it('cell displayName is lastName+firstName', () => {
      const member = makeMember({ publicId: 'x', groupPublicId: 'g1', lastName: '이', firstName: '영희' });
      const m = service.buildMatrix([member], [group1]);
      expect(m.divisions[0].groups[0].members[0].displayName).toBe('이영희');
    });
  });

  describe('endpoints', () => {
    it('reads the 양육 member list and the groups, not the admin /v1/members', () => {
      const http = TestBed.inject(HttpTestingController);
      let result: unknown;
      service.loadDashboardData().subscribe(r => (result = r));
      http.expectOne(r => r.url === '/api/v1/church-groups/members' && r.params.get('size') === '10000')
        .flush({ success: true, data: { content: [makeMember()], totalElements: 1, totalPages: 1, number: 0, size: 10000 } });
      http.expectOne('/api/v1/church-groups').flush({ success: true, data: [] });
      http.match(r => r.url.includes('/trainings/catalog')).forEach(r => r.flush({ success: true, data: CATALOG }));
      expect(result).toEqual({ members: [makeMember()], groups: [] });
      http.expectNone('/api/v1/members');
    });

    it('sets 예비순장 through the 양육 endpoint', () => {
      const http = TestBed.inject(HttpTestingController);
      service.setNextGroupLeader('pub-1', true).subscribe();
      const req = http.expectOne('/api/v1/church-groups/members/pub-1/next-leader');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ isNextGroupLeader: true });
      req.flush({ success: true, data: { publicId: 'pub-1', isNextGroupLeader: true } });
    });
  });
});
