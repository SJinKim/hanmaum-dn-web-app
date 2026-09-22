import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MemberSummary } from '../../core/models/member.model';
import { MemberService } from './member.service';

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

  it('never sends role or sort — the server ignores both (hanmaum-dn-server#196)', () => {
    service.setSearch('김');
    const url = flushList();

    expect(url).toContain('search=');
    expect(url).not.toContain('role=');
    expect(url).not.toContain('sort=');
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
