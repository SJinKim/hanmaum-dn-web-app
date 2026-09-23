import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MemberSummary } from '../../core/models/member.model';
import { MemberService, UNASSIGNED_GROUP } from './member.service';

function summary(publicId: string): MemberSummary {
  return {
    publicId,
    lastName: '김',
    firstName: '청년',
    email: null,
    memberStatus: 'ACTIVE',
    baptism: null,
    groupName: null,
  };
}

describe('MemberService — 청년 list state (#53)', () => {
  let service: MemberService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MemberService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Answers the one outstanding list request with a single-item page. */
  function flushList(content: MemberSummary[] = [summary('a')], totalElements = content.length): string {
    const req = http.expectOne(r => r.url.endsWith('/v1/members'));
    const url = req.request.urlWithParams;
    req.flush({
      success: true,
      message: null,
      data: { content, totalElements, totalPages: 1, number: 0, size: 20 },
    });
    return url;
  }

  it('loads page 0 with the default size and fills members/total', () => {
    service.loadMembers();
    const url = flushList([summary('a'), summary('b')], 2);

    expect(url).toContain('page=0');
    expect(url).toContain('size=20');
    expect(service.members().length).toBe(2);
    expect(service.total()).toBe(2);
    expect(service.listLoading()).toBeFalse();
    expect(service.listFailed()).toBeFalse();
  });

  it('never sends role, and no sort until a header was clicked', () => {
    service.setSearch('김');
    const url = flushList();

    expect(url).toContain('search=');
    expect(url).not.toContain('role=');
    expect(url).not.toContain('sort=');
  });

  // #68: 이름, 상태, 순 and 세례 sort on the server.
  it('sorts a new column ascending, then flips it on the next click', () => {
    service.toggleSort('groupName');
    expect(flushList()).toContain('sort=groupName,asc');

    service.toggleSort('groupName');
    expect(flushList()).toContain('sort=groupName,desc');

    service.toggleSort('groupName');
    expect(flushList()).toContain('sort=groupName,asc');
  });

  it('starts a different column ascending again', () => {
    service.toggleSort('baptism');
    flushList();
    service.toggleSort('baptism');
    flushList();

    service.toggleSort('memberStatus');
    const url = flushList();

    expect(url).toContain('sort=memberStatus,asc');
    expect(url).not.toContain('baptism');
  });

  it('returns to page 0 on a sort change but keeps the filters', () => {
    service.setStatus('ACTIVE');
    flushList();
    service.setPage(2);
    flushList();

    service.toggleSort('lastName');
    const url = flushList();

    expect(service.page()).toBe(0);
    expect(url).toContain('page=0');
    expect(url).toContain('status=ACTIVE');
  });

  it('keeps the sort across page changes, filter changes and a filter reset', () => {
    service.toggleSort('lastName');
    flushList();
    service.toggleSort('lastName');
    flushList();

    service.setPage(1);
    expect(flushList()).toContain('sort=lastName,desc');
    service.setBaptism('GENERAL_BAPTIZED');
    expect(flushList()).toContain('sort=lastName,desc');
    service.resetFilters();
    expect(flushList()).toContain('sort=lastName,desc');
  });

  it('resets to page 0 when a filter changes', () => {
    service.setPage(3);
    flushList();
    expect(service.page()).toBe(3);

    service.setStatus('PENDING');
    const url = flushList();

    expect(service.page()).toBe(0);
    expect(url).toContain('page=0');
    expect(url).toContain('status=PENDING');
  });

  it('keeps the filters when the page changes', () => {
    service.setStatus('PENDING');
    flushList();
    service.setBaptism('GENERAL_BAPTIZED');
    flushList();

    service.setPage(2);
    const url = flushList();

    expect(url).toContain('page=2');
    expect(url).toContain('status=PENDING');
    expect(url).toContain('baptism=GENERAL_BAPTIZED');
  });

  it('clears filters and page on reset', () => {
    service.setSearch('김');
    flushList();

    service.resetFilters();
    const url = flushList();

    expect(service.search()).toBe('');
    expect(service.status()).toBeNull();
    expect(service.baptism()).toBeNull();
    expect(url).not.toContain('search=');
    expect(url).not.toContain('status=');
  });

  // #79: 순/양육/사역 are server-side parameters (hanmaum-dn-server#196).
  it('sends a chosen group as groupPublicId and returns to page 0', () => {
    service.setPage(2);
    flushList();

    service.setGroup('g-1');
    const url = flushList();

    expect(service.page()).toBe(0);
    expect(url).toContain('groupPublicId=g-1');
    expect(url).not.toContain('unassigned=');
  });

  it('sends 미배정 as unassigned=true and never together with groupPublicId', () => {
    service.setGroup(UNASSIGNED_GROUP);
    const url = flushList();

    expect(url).toContain('unassigned=true');
    expect(url).not.toContain('groupPublicId=');
  });

  it('sends the training code and the ministry publicId', () => {
    service.setTraining('ONE_ON_ONE');
    flushList();
    service.setMinistry('min-1');
    const url = flushList();

    expect(url).toContain('trainingCode=ONE_ON_ONE');
    expect(url).toContain('ministryPublicId=min-1');
  });

  it('clears 순, 양육 and 사역 on reset', () => {
    service.setGroup('g-1');
    flushList();
    service.setTraining('ONE_ON_ONE');
    flushList();
    service.setMinistry('min-1');
    flushList();

    service.resetFilters();
    const url = flushList();

    expect(service.group()).toBeNull();
    expect(service.training()).toBeNull();
    expect(service.ministry()).toBeNull();
    expect(url).not.toContain('groupPublicId=');
    expect(url).not.toContain('trainingCode=');
    expect(url).not.toContain('ministryPublicId=');
  });

  it('empties the list and flags the failure when the request errors', () => {
    service.loadMembers();
    http
      .expectOne(r => r.url.endsWith('/v1/members'))
      .flush({ success: false, message: 'boom', data: null }, { status: 500, statusText: 'Server Error' });

    expect(service.members()).toEqual([]);
    expect(service.total()).toBe(0);
    expect(service.listFailed()).toBeTrue();
    expect(service.listLoading()).toBeFalse();
  });

  it('refreshPendingCount asks for one PENDING row only', () => {
    service.refreshPendingCount();
    const req = http.expectOne(r => r.url.endsWith('/v1/members'));

    expect(req.request.urlWithParams).toContain('status=PENDING');
    expect(req.request.urlWithParams).toContain('size=1');
    req.flush({
      success: true,
      message: null,
      data: { content: [], totalElements: 7, totalPages: 7, number: 0, size: 1 },
    });

    expect(service.pendingCount()).toBe(7);
  });
});
