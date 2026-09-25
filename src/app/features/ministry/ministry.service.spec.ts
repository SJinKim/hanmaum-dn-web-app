import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MinistryService } from './ministry.service';
import {
  MemberNameDto, AddMinistryMemberRequest, ActiveMinistryMemberDto, MinistryRegistrationDto,
} from './ministry.model';

describe('MinistryService — add member', () => {
  let service: MinistryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MinistryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getMemberNames() GETs /v1/members/names and unwraps data', () => {
    const names: MemberNameDto[] = [
      { publicId: 'm1', fullName: '김철수', discriminator: 'A' },
    ];
    let received: MemberNameDto[] | undefined;
    service.getMemberNames().subscribe(r => (received = r));

    const req = http.expectOne(r => r.url.endsWith('/v1/members/names'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: null, data: names });

    expect(received).toEqual(names);
  });

  it('addMember() POSTs the body to the ministry members endpoint and unwraps data', () => {
    const body: AddMinistryMemberRequest = {
      memberId: 'm1',
      startDate: '2026-06-01',
      note: '신규',
    };
    const dto: ActiveMinistryMemberDto = {
      publicId: 'm1',
      fullName: '김철수',
      startDate: '2026-06-01',
      note: '신규',
      gender: 'M',
    };
    let received: ActiveMinistryMemberDto | undefined;
    service.addMember('ministry-1', body).subscribe(r => (received = r));

    const req = http.expectOne(r => r.url.endsWith('/v1/ministries/ministry-1/members'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ success: true, message: null, data: dto });

    expect(received).toEqual(dto);
  });
  it('getPendingApplications() GETs the applications of a ministry and unwraps data', () => {
    const pending: ActiveMinistryMemberDto[] = [{
      publicId: 'm2', fullName: '이영희', startDate: '2026-09-20', note: null, gender: 'F',
      status: 'PENDING', selfIntroduction: '찬양을 좋아합니다', appliedAt: '2026-09-20T10:00:00Z',
    }];
    let received: ActiveMinistryMemberDto[] | undefined;
    service.getPendingApplications('ministry-1').subscribe(r => (received = r));

    const req = http.expectOne(r => r.url.endsWith('/v1/ministries/ministry-1/applications'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: null, data: pending });

    expect(received).toEqual(pending);
  });

  it('reviewApplication() PATCHes the decision for one applicant and unwraps data', () => {
    const dto: MinistryRegistrationDto = {
      ministryPublicId: 'ministry-1', ministryName: '찬양팀', appliedAt: '2026-09-20T10:00:00Z',
      status: 'REJECTED', leaderNotified: false, rejectionMessage: '다음 기회에',
    };
    let received: MinistryRegistrationDto | undefined;
    service.reviewApplication('ministry-1', 'm2', { decision: 'REJECT', message: '다음 기회에' })
      .subscribe(r => (received = r));

    const req = http.expectOne(r => r.url.endsWith('/v1/ministries/ministry-1/applications/m2'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ decision: 'REJECT', message: '다음 기회에' });
    req.flush({ success: true, message: null, data: dto });

    expect(received).toEqual(dto);
  });
});
