import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { readApiError } from '../http/api-error';
import { longAbsenceFixture, longAbsenceSummaryFixture } from '../models/long-absent.fixtures.spec';
import { LongAbsence, LongAbsenceSummary } from '../models/long-absent.model';
import { LongAbsentApi } from './long-absent-api.service';

const BASE = '/api/v1/attendance/long-absences';
const ID = '00000000-0000-4000-8000-000000000001';

describe('LongAbsentApi (#277)', () => {
  let api: LongAbsentApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(LongAbsentApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists without any query parameter and keeps nullable fields as null', () => {
    let rows: LongAbsence[] | undefined;
    api.list().subscribe(r => (rows = r));
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ success: true, message: null, data: [longAbsenceFixture({ group: null })] });
    expect(rows?.[0].group).toBeNull();
    expect(rows?.[0].memo).toBeNull();
  });

  it('reads the memo-free summary', () => {
    let summary: LongAbsenceSummary | undefined;
    api.summary().subscribe(s => (summary = s));
    const req = http.expectOne(`${BASE}/summary`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ success: true, message: null, data: longAbsenceSummaryFixture() });
    expect(summary?.uncontactedCount).toBe(2);
  });

  it('sends the contact status without memoUpdate when the memo stays', () => {
    api.setContactStatus(ID, { lastSundayDate: '2026-07-26', version: 4, contacted: false }).subscribe();
    const req = http.expectOne(`${BASE}/${ID}/contact-status`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ lastSundayDate: '2026-07-26', version: 4, contacted: false });
    expect('memoUpdate' in req.request.body).toBeFalse();
    req.flush({ success: true, message: null, data: longAbsenceFixture() });
  });

  it('sends memoUpdate with an explicit value', () => {
    api
      .setContactStatus(ID, { lastSundayDate: '2026-07-26', version: 1, contacted: false, memoUpdate: { value: null } })
      .subscribe();
    const req = http.expectOne(`${BASE}/${ID}/contact-status`);
    expect(req.request.body.memoUpdate).toEqual({ value: null });
    req.flush({ success: true, message: null, data: longAbsenceFixture() });
  });

  it('always sends the memo key, null included', () => {
    api.setMemo(ID, { lastSundayDate: '2026-07-26', version: 0, memo: null }).subscribe();
    const req = http.expectOne(`${BASE}/${ID}/memo`);
    expect(req.request.method).toBe('PUT');
    expect('memo' in req.request.body).toBeTrue();
    expect(req.request.body.memo).toBeNull();
    req.flush({ success: true, message: null, data: longAbsenceFixture() });
  });

  for (const [status, code] of [
    [400, 'LONG_ABSENCE_INVALID_REQUEST'],
    [403, null],
    [404, null],
    [409, 'LONG_ABSENCE_NOT_CURRENT'],
    [409, 'LONG_ABSENCE_VERSION_CONFLICT'],
  ] as const) {
    it(`passes a ${status} problem detail${code ? ` (${code})` : ''} through readable`, () => {
      let error: unknown;
      api.setMemo(ID, { lastSundayDate: '2026-07-26', version: 0, memo: 'x' }).subscribe({ error: e => (error = e) });
      http
        .expectOne(`${BASE}/${ID}/memo`)
        .flush({ status, title: 'x', ...(code ? { code } : {}) }, { status, statusText: 'x' });
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect(readApiError(error)).toEqual(jasmine.objectContaining({ status, code }));
    });
  }
});
