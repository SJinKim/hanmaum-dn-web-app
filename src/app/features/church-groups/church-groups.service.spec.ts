import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChurchGroupsService } from './church-groups.service';
import { MemberSummary, ChurchGroupSummary } from '../../core/models/member.model';

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

    it('returns empty array when no members', () => {
      const rows = service.buildMatrix([], [group1]);
      expect(rows).toEqual([]);
    });

    it('places members in correct group column', () => {
      const m = makeMember({ groupPublicId: 'g1' });
      const rows = service.buildMatrix([m], [group1, group2]);
      expect(rows.length).toBe(1);
      expect(rows[0]['grp_g1']).toBeTruthy();
      expect(rows[0]['grp_g2']).toBeNull();
    });

    it('row count equals the largest group size', () => {
      const members = [
        makeMember({ publicId: 'a', groupPublicId: 'g1' }),
        makeMember({ publicId: 'b', groupPublicId: 'g1' }),
        makeMember({ publicId: 'c', groupPublicId: 'g2' }),
      ];
      const rows = service.buildMatrix(members, [group1, group2]);
      expect(rows.length).toBe(2);
      expect(rows[1]['grp_g2']).toBeNull();
    });

    it('ignores members with no groupPublicId', () => {
      const m = makeMember({ groupPublicId: null });
      const rows = service.buildMatrix([m], [group1]);
      expect(rows).toEqual([]);
    });

    it('cell displayName is lastName+firstName', () => {
      const m = makeMember({ publicId: 'x', groupPublicId: 'g1', lastName: '이', firstName: '영희' });
      const rows = service.buildMatrix([m], [group1]);
      expect(rows[0]['grp_g1']?.displayName).toBe('이영희');
    });
  });
});
