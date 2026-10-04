import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Member } from '../../core/models/member.model';
import { MinistryHistory } from '../../core/models/member-activity.model';
import { MemberService } from '../members/member.service';
import { MinistryAssignmentService, withAssignmentPatched } from './ministry-assignment.service';

const HISTORY: MinistryHistory[] = [
  { ministryPublicId: 'min-1', name: '찬양팀', startDate: '2020-01-01', endDate: '2021-01-01', note: '1기' },
  { ministryPublicId: 'min-1', name: '찬양팀', startDate: '2023-03-01', endDate: null, note: null },
  { ministryPublicId: 'min-2', name: '새가족팀', startDate: '2024-01-01', endDate: null, note: '리더' },
];

describe('withAssignmentPatched', () => {
  it('changes only the ongoing assignment to the ministry', () => {
    expect(withAssignmentPatched(HISTORY, 'min-1', { startDate: '2023-04-01', note: '보컬' })).toEqual([
      { ministryPublicId: 'min-1', startDate: '2020-01-01', endDate: '2021-01-01', note: '1기' },
      { ministryPublicId: 'min-1', startDate: '2023-04-01', endDate: null, note: '보컬' },
      { ministryPublicId: 'min-2', startDate: '2024-01-01', endDate: null, note: '리더' },
    ]);
  });
});

describe('MinistryAssignmentService', () => {
  let members: jasmine.SpyObj<MemberService>;
  let service: MinistryAssignmentService;

  beforeEach(() => {
    members = jasmine.createSpyObj<MemberService>('MemberService', ['getMember', 'replaceMemberMinistries']);
    members.getMember.and.returnValue(of({ publicId: 'm1', ministries: HISTORY } as Member));
    members.replaceMemberMinistries.and.returnValue(of({} as Member));
    TestBed.configureTestingModule({ providers: [{ provide: MemberService, useValue: members }] });
    service = TestBed.inject(MinistryAssignmentService);
  });

  it('ends the assignment and keeps the member\'s other ministries', () => {
    service.endAssignment('m1', 'min-1', '2026-09-25').subscribe();

    expect(members.getMember).toHaveBeenCalledOnceWith('m1');
    expect(members.replaceMemberMinistries).toHaveBeenCalledOnceWith('m1', [
      { ministryPublicId: 'min-1', startDate: '2020-01-01', endDate: '2021-01-01', note: '1기' },
      { ministryPublicId: 'min-1', startDate: '2023-03-01', endDate: '2026-09-25', note: null },
      { ministryPublicId: 'min-2', startDate: '2024-01-01', endDate: null, note: '리더' },
    ]);
  });
});
