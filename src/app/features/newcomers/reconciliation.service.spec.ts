import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReconciliationService } from './reconciliation.service';
import { reconciliationError } from '../../core/models/reconciliation.model';

describe('ReconciliationService — 계정 연결 확인 (#45)', () => {
  let service: ReconciliationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReconciliationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const ok = (data: unknown) => ({ success: true, message: null, data });

  it('lists one status page by page', () => {
    let total = -1;
    service.list('OPEN', 1, 10).subscribe(p => (total = p.totalElements));

    const req = http.expectOne(r => r.url.endsWith('/v1/newcomers/reconciliations'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('OPEN');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('10');
    req.flush(ok({ content: [], totalElements: 3, totalPages: 1, number: 1, size: 10 }));
    expect(total).toBe(3);
  });

  it('links, merges and dismisses with the version it was shown', () => {
    service.link('r-1', { memberPublicId: 'm-2', version: 4 }).subscribe();
    service.merge('r-1', { memberPublicId: 'm-2', version: 4 }).subscribe();
    service.dismiss('r-1', 4).subscribe();

    const link = http.expectOne(r => r.url.endsWith('/v1/newcomers/reconciliations/r-1/link'));
    expect(link.request.body).toEqual({ memberPublicId: 'm-2', version: 4 });
    link.flush(ok({}));
    http.expectOne(r => r.url.endsWith('/r-1/merge')).flush(ok({}));
    const dismiss = http.expectOne(r => r.url.endsWith('/r-1/dismiss'));
    expect(dismiss.request.body).toEqual({ version: 4 });
    dismiss.flush(ok({}));
  });
});

describe('reconciliationError', () => {
  it('tells the 409s apart by the server message', () => {
    expect(reconciliationError(409, 'The reconciliation has already been resolved.')).toBe('resolved');
    expect(reconciliationError(409, 'The reconciliation changed. Reload and retry.')).toBe('stale');
    expect(reconciliationError(409, 'Both members have newcomer history; use the merge action.')).toBe('useMerge');
    expect(reconciliationError(409, 'The selected member is already linked to another account.')).toBe('alreadyLinked');
    expect(reconciliationError(409, 'The registration is no longer linked to an account.')).toBe('registrationUnlinked');
  });

  it('maps the 400s, 404 and anything else', () => {
    expect(reconciliationError(400, 'The selected member is no longer active.')).toBe('memberInactive');
    expect(reconciliationError(400, 'The selected member is not a current candidate.')).toBe('notCandidate');
    expect(reconciliationError(404, null)).toBe('notFound');
    expect(reconciliationError(500, 'boom')).toBe('failed');
    expect(reconciliationError(409, 'something new')).toBe('failed');
  });
});
