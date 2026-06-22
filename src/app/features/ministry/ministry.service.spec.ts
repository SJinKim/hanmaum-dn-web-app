import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MinistryService } from './ministry.service';
import { MemberNameDto, AddMinistryMemberRequest, ActiveMinistryMemberDto } from './ministry.model';

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
});
