import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PageResponse } from '../../core/models/api-response.model';
import { MemberSummary } from '../../core/models/member.model';
import { TrainingCatalogEntry } from '../../core/models/member-activity.model';
import { TrainingCatalogService } from '../../core/services/training-catalog.service';
import { MemberService } from '../members/member.service';
import { ActiveMinistryMemberDto, MinistrySummary } from '../ministry/ministry.model';
import { MinistryService } from '../ministry/ministry.service';
import { ArchiveService } from './archive.service';

const entry = (code: string, sortOrder: number): TrainingCatalogEntry => ({
  publicId: code, code, name: `${code} name`, nameKo: code, category: null, sortOrder,
  hasCohorts: false, isActive: true, prerequisiteCode: null,
});

const member = (id: string, patch: Partial<MemberSummary>): MemberSummary => ({
  publicId: id, lastName: '김', firstName: id, email: null, memberStatus: 'ACTIVE',
  baptism: null, groupName: null, ...patch,
});

describe('ArchiveService', () => {
  let members: jasmine.SpyObj<MemberService>;
  let ministries: jasmine.SpyObj<MinistryService>;
  let service: ArchiveService;

  beforeEach(() => {
    members = jasmine.createSpyObj<MemberService>('MemberService', ['getMembers']);
    ministries = jasmine.createSpyObj<MinistryService>('MinistryService', ['getMinistries', 'getMemberHistory']);
    TestBed.configureTestingModule({
      providers: [
        { provide: MemberService, useValue: members },
        { provide: MinistryService, useValue: ministries },
        { provide: TrainingCatalogService, useValue: { load: () => of([entry('QBS', 2), entry('ONE', 1)]) } },
      ],
    });
    service = TestBed.inject(ArchiveService);
  });

  it('groups completed trainings per course in catalog order, graduates included', () => {
    members.getMembers.and.returnValue(of({ content: [
      member('a', { trainings: [{ name: 'ONE name', status: 'COMPLETED' }] }),
      member('b', { memberStatus: 'INACTIVE', trainings: [{ name: 'ONE name', status: 'COMPLETED' }, { name: 'QBS name', status: 'COMPLETED' }] }),
      member('c', { trainings: [{ name: 'QBS name', status: 'IN_PROGRESS' }] }),
      member('d', { memberStatus: 'DELETED', trainings: [{ name: 'QBS name', status: 'COMPLETED' }] }),
    ], totalElements: 4 } as unknown as PageResponse<MemberSummary>));

    let result: { code: string; ids: string[] }[] = [];
    service.loadTrainingArchive().subscribe(r => {
      result = r.map(x => ({ code: x.entry.code, ids: x.members.map(m => m.publicId) }));
    });

    expect(members.getMembers).toHaveBeenCalledWith({ size: 9999 });
    expect(result).toEqual([{ code: 'ONE', ids: ['a', 'b'] }, { code: 'QBS', ids: ['b'] }]);
  });

  it('keeps only ended assignments, latest 종료일 first', () => {
    ministries.getMinistries.and.returnValue(of([{ publicId: 'm1' } as MinistrySummary]));
    ministries.getMemberHistory.and.returnValue(of([
      { publicId: 'a', startDate: '2020-01-01', endDate: '2022-01-01' },
      { publicId: 'b', startDate: '2021-01-01' },
      { publicId: 'c', startDate: '2021-01-01', endDate: '2024-01-01' },
    ] as ActiveMinistryMemberDto[]));

    let ids: string[] = [];
    service.loadMinistryArchive().subscribe(r => { ids = r[0].members.map(m => m.publicId); });

    expect(ministries.getMemberHistory).toHaveBeenCalledWith('m1');
    expect(ids).toEqual(['c', 'a']);
  });

  it('emits an empty list without ministries', () => {
    ministries.getMinistries.and.returnValue(of([]));
    let result: unknown[] | undefined;
    service.loadMinistryArchive().subscribe(r => { result = r; });
    expect(result).toEqual([]);
  });
});
