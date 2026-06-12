import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChurchGroupsService } from './church-groups.service';
import { MemberSummary, ChurchGroupSummary } from '../../core/models/member.model';
import { MinistrySummary } from '../ministry/ministry.model';

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
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChurchGroupsService);
  });

  describe('computeCategory', () => {
    it('returns NEXT_LEADER when isNextGroupLeader is true', () => {
      expect(service.computeCategory(makeMember({ isNextGroupLeader: true }))).toBe('NEXT_LEADER');
    });

    it('NEXT_LEADER overrides any training status', () => {
      const m = makeMember({
        isNextGroupLeader: true,
        trainings: [{ name: '1on1', status: 'IN_PROGRESS' }],
      });
      expect(service.computeCategory(m)).toBe('NEXT_LEADER');
    });

    it('returns ONE_ON_ONE_IN_PROGRESS when 1on1 is IN_PROGRESS', () => {
      const m = makeMember({ trainings: [{ name: '1on1', status: 'IN_PROGRESS' }] });
      expect(service.computeCategory(m)).toBe('ONE_ON_ONE_IN_PROGRESS');
    });

    it('returns ONE_ON_ONE_WAITING when QTBS COMPLETED and signup filled', () => {
      const m = makeMember({
        trainings: [{ name: 'QTBS', status: 'COMPLETED' }],
        oneOnOneSignupFilled: true,
      });
      expect(service.computeCategory(m)).toBe('ONE_ON_ONE_WAITING');
    });

    it('returns QBS_COMPLETED when QTBS COMPLETED but signup NOT filled', () => {
      const m = makeMember({
        trainings: [{ name: 'QTBS', status: 'COMPLETED' }],
        oneOnOneSignupFilled: false,
      });
      expect(service.computeCategory(m)).toBe('QBS_COMPLETED');
    });

    it('returns DISCIPLESHIP_COMPLETED when Discipleship COMPLETED', () => {
      const m = makeMember({ trainings: [{ name: 'Discipleship', status: 'COMPLETED' }] });
      expect(service.computeCategory(m)).toBe('DISCIPLESHIP_COMPLETED');
    });

    it('DISCIPLESHIP_COMPLETED beats QBS_COMPLETED even though QTBS is also completed', () => {
      const m = makeMember({
        trainings: [
          { name: 'QTBS', status: 'COMPLETED' },
          { name: '1on1', status: 'COMPLETED' },
          { name: 'Discipleship', status: 'COMPLETED' },
        ],
      });
      expect(service.computeCategory(m)).toBe('DISCIPLESHIP_COMPLETED');
    });

    it('returns ONE_ON_ONE_COMPLETED when 1on1 is COMPLETED', () => {
      const m = makeMember({ trainings: [{ name: '1on1', status: 'COMPLETED' }] });
      expect(service.computeCategory(m)).toBe('ONE_ON_ONE_COMPLETED');
    });

    it('returns ONE_ON_ONE_COMPLETED when Discipleship is IN_PROGRESS (1on1 already done)', () => {
      const m = makeMember({
        trainings: [
          { name: 'QTBS', status: 'COMPLETED' },
          { name: '1on1', status: 'COMPLETED' },
          { name: 'Discipleship', status: 'IN_PROGRESS' },
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
      const m = makeMember({ trainings: [{ name: 'QTBS', status: 'IN_PROGRESS' }] });
      expect(service.computeCategory(m)).not.toBe('QBS_COMPLETED');
    });
  });

  describe('buildMatrix', () => {
    const group1: ChurchGroupSummary = { publicId: 'g1', division: '느헤미야', name: '믿음' };
    const group2: ChurchGroupSummary = { publicId: 'g2', division: '느헤미야', name: '소망' };
    const group3: ChurchGroupSummary = { publicId: 'g3', division: '다니엘', name: '온유' };

    it('returns rowCount 0 and empty newcomers when no members', () => {
      const m = service.buildMatrix([], [group1]);
      expect(m.rowCount).toBe(0);
      expect(m.newcomers).toEqual([]);
      expect(m.divisions.length).toBe(1);
      expect(m.divisions[0].groups[0].members).toEqual([]);
    });

    it('groups columns by division in stable order', () => {
      const m = service.buildMatrix([], [group1, group2, group3]);
      expect(m.divisions.map(d => d.division)).toEqual(['느헤미야', '다니엘']);
      expect(m.divisions[0].groups.map(g => g.name)).toEqual(['믿음', '소망']);
      expect(m.divisions[1].groups.map(g => g.name)).toEqual(['온유']);
    });

    it('orders NEHEMIA before DANIEL regardless of input order', () => {
      const daniel: ChurchGroupSummary = { publicId: 'd1', division: 'DANIEL', name: '온유' };
      const nehemia: ChurchGroupSummary = { publicId: 'n1', division: 'NEHEMIA', name: '믿음' };
      const m = service.buildMatrix([], [daniel, nehemia]);
      expect(m.divisions.map(d => d.division)).toEqual(['NEHEMIA', 'DANIEL']);
    });

    it('excludes groups with no division and folds their members into newcomers', () => {
      const newFamily: ChurchGroupSummary = { publicId: 'nf', division: null, name: '새가족' };
      const member = makeMember({ publicId: 'x', groupPublicId: 'nf' });
      const m = service.buildMatrix([member], [group1, newFamily]);
      expect(m.divisions.map(d => d.division)).toEqual(['느헤미야']);
      expect(m.divisions.some(d => d.groups.some(g => g.name === '새가족'))).toBe(false);
      expect(m.newcomers.length).toBe(1);
      expect(m.newcomers[0].publicId).toBe('x');
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

    it('rowCount accounts for the newcomers column', () => {
      const members = [
        makeMember({ publicId: 'a', groupPublicId: null }),
        makeMember({ publicId: 'b', groupPublicId: null }),
      ];
      const m = service.buildMatrix(members, [group1]);
      expect(m.rowCount).toBe(2);
      expect(m.newcomers.length).toBe(2);
    });

    it('places members with no groupPublicId in newcomers', () => {
      const member = makeMember({ groupPublicId: null });
      const m = service.buildMatrix([member], [group1]);
      expect(m.newcomers.length).toBe(1);
      expect(m.divisions[0].groups[0].members.length).toBe(0);
    });

    it('resolves the 순장 leader name for a group', () => {
      const leader = makeMember({ publicId: 'L', groupPublicId: 'g1', lastName: '서', firstName: '준', churchRole: '순장' });
      const m = service.buildMatrix([leader], [group1]);
      expect(m.divisions[0].groups[0].leader).toBe('서준');
    });

    it('leader is empty string when no 순장 in the group', () => {
      const member = makeMember({ publicId: 'x', groupPublicId: 'g1', churchRole: null });
      const m = service.buildMatrix([member], [group1]);
      expect(m.divisions[0].groups[0].leader).toBe('');
    });

    it('excludes the newcomers leader (팀장) from the newcomers cells', () => {
      const leader = makeMember({ publicId: 'lead', groupPublicId: null, lastName: '정', firstName: '현우' });
      const other = makeMember({ publicId: 'oth', groupPublicId: null, lastName: '김', firstName: '철수' });
      const m = service.buildMatrix([leader, other], [group1], '정현우');
      expect(m.newcomers.map(c => c.displayName)).toEqual(['김철수']);
    });

    it('cell displayName is lastName+firstName', () => {
      const member = makeMember({ publicId: 'x', groupPublicId: 'g1', lastName: '이', firstName: '영희' });
      const m = service.buildMatrix([member], [group1]);
      expect(m.divisions[0].groups[0].members[0].displayName).toBe('이영희');
    });
  });

  describe('resolveNewcomersLeader', () => {
    function makeMinistry(overrides: Partial<MinistrySummary> = {}): MinistrySummary {
      return {
        publicId: 'min-1',
        title: '선교팀',
        subtitle: '',
        imageUrl: null,
        contacts: [],
        isActive: true,
        ...overrides,
      };
    }

    it('returns the 팀장 contact name of the ministry whose title contains 새가족', () => {
      const ministries = [
        makeMinistry({ title: '선교팀', contacts: [{ role: '팀장', name: '김선교' }] }),
        makeMinistry({ title: '새가족팀', contacts: [{ role: '팀장', name: '정현우' }] }),
      ];
      expect(service.resolveNewcomersLeader(ministries)).toBe('정현우');
    });

    it('returns empty string when no 새가족 ministry exists', () => {
      expect(service.resolveNewcomersLeader([makeMinistry({ title: '선교팀', contacts: [{ role: '팀장', name: '김선교' }] })])).toBe('');
    });

    it('returns empty string when the 새가족 ministry has no 팀장 contact', () => {
      expect(service.resolveNewcomersLeader([makeMinistry({ title: '새가족팀', contacts: [] })])).toBe('');
    });
  });
});
