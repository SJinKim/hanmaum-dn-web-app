import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import {
  longAbsenceFixture,
  longAbsenceListFixture,
} from '../../../core/models/long-absent.fixtures.spec';
import { LongAbsence } from '../../../core/models/long-absent.model';
import { LongAbsentApi } from '../../../core/services/long-absent-api.service';
import { LongAbsentState, LongAbsentWriteResult } from './long-absent-state.service';

function httpError(status: number, code?: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: code ? { status, code } : { status } });
}

describe('LongAbsentState (#277)', () => {
  let api: jasmine.SpyObj<LongAbsentApi>;
  let state: LongAbsentState;
  let input: LongAbsence[];

  beforeEach(() => {
    api = jasmine.createSpyObj<LongAbsentApi>('LongAbsentApi', ['list', 'summary', 'setContactStatus', 'setMemo']);
    input = longAbsenceListFixture();
    api.list.and.returnValue(of(input));
    TestBed.configureTestingModule({ providers: [LongAbsentState, { provide: LongAbsentApi, useValue: api }] });
    state = TestBed.inject(LongAbsentState);
  });

  function write(result$: { subscribe: (fn: (r: LongAbsentWriteResult) => void) => unknown }): LongAbsentWriteResult[] {
    const results: LongAbsentWriteResult[] = [];
    result$.subscribe(r => results.push(r));
    return results;
  }

  it('starts on 미연락 and counts all, open and done from the full list', () => {
    state.load();
    expect(state.filter()).toBe('open');
    expect(state.totalCount()).toBe(3);
    expect(state.openCount()).toBe(2);
    expect(state.doneCount()).toBe(1);
    expect(state.visibleRows().map(r => r.fullName)).toEqual(['John Doe', '홍길동']);
  });

  it('filters without touching the server order or the input array', () => {
    state.load();
    const before = input.map(r => r.memberPublicId);
    state.setFilter('done');
    expect(state.visibleRows().map(r => r.fullName)).toEqual(['Max Mustermann']);
    state.setFilter('all');
    expect(state.visibleRows().map(r => r.fullName)).toEqual(['John Doe', 'Max Mustermann', '홍길동']);
    expect(input.map(r => r.memberPublicId)).toEqual(before);
    expect(state.totalCount()).toBe(3);
  });

  it('turns a failed load into the error state and a successful [] into ready', () => {
    api.list.and.returnValue(throwError(() => httpError(500)));
    state.load();
    expect(state.status()).toBe('error');
    api.list.and.returnValue(of([]));
    state.load();
    expect(state.status()).toBe('ready');
    expect(state.totalCount()).toBe(0);
  });

  it('marks contacted with the loaded anchor and version, takes the server row and reloads', () => {
    state.load();
    const row = state.rows()[0];
    const saved = { ...row, contacted: true, contactedBy: 's', contactedAt: '2026-10-31T10:00:00Z', version: 1 };
    api.setContactStatus.and.returnValue(of(saved));
    api.list.calls.reset();
    api.list.and.returnValue(of([saved, ...state.rows().slice(1)]));

    expect(write(state.setContacted(row, true))).toEqual(['saved']);
    expect(api.setContactStatus).toHaveBeenCalledWith(row.memberPublicId, {
      lastSundayDate: row.lastSundayDate,
      version: row.version,
      contacted: true,
    });
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(state.rows()[0].contacted).toBeTrue();
    expect(state.isBusy(row)).toBeFalse();
  });

  it('sends memoUpdate only when given', () => {
    state.load();
    const row = state.rows()[1];
    api.setContactStatus.and.returnValue(of(row));
    write(state.setContacted(row, false, { value: '이사\n복귀 예정' }));
    expect(api.setContactStatus.calls.mostRecent().args[1]).toEqual({
      lastSundayDate: row.lastSundayDate,
      version: row.version,
      contacted: false,
      memoUpdate: { value: '이사\n복귀 예정' },
    });
  });

  it('sends the memo key, null for a deliberate clear', () => {
    state.load();
    const row = state.rows()[1];
    api.setMemo.and.returnValue(of({ ...row, memo: null }));
    write(state.setMemo(row, null));
    expect(api.setMemo).toHaveBeenCalledWith(row.memberPublicId, {
      lastSundayDate: row.lastSundayDate,
      version: row.version,
      memo: null,
    });
  });

  it('allows one write per person at a time', () => {
    state.load();
    const row = state.rows()[0];
    const pending = new Subject<LongAbsence>();
    api.setContactStatus.and.returnValue(pending);
    write(state.setContacted(row, true));
    expect(state.isBusy(row)).toBeTrue();
    expect(write(state.setContacted(row, true))).toEqual([]);
    expect(api.setContactStatus).toHaveBeenCalledTimes(1);
  });

  for (const code of ['LONG_ABSENCE_NOT_CURRENT', 'LONG_ABSENCE_VERSION_CONFLICT']) {
    it(`reloads on 409 ${code} without sending again`, () => {
      state.load();
      api.setMemo.and.returnValue(throwError(() => httpError(409, code)));
      const fresh = [longAbsenceFixture({ lastSundayDate: '2026-08-02', version: 0, memo: null })];
      api.list.and.returnValue(of(fresh));
      expect(write(state.setMemo(state.rows()[0], 'x'))).toEqual(['conflict']);
      expect(api.setMemo).toHaveBeenCalledTimes(1);
      expect(state.rows()).toEqual(fresh);
    });
  }

  it('reloads on 404', () => {
    state.load();
    api.setContactStatus.and.returnValue(throwError(() => httpError(404)));
    api.list.and.returnValue(of([]));
    expect(write(state.setContacted(state.rows()[0], true))).toEqual(['notFound']);
    expect(state.totalCount()).toBe(0);
  });

  it('drops every person and memo on 403 and stops loading', () => {
    state.load();
    api.setMemo.and.returnValue(throwError(() => httpError(403)));
    api.list.calls.reset();
    expect(write(state.setMemo(state.rows()[1], 'x'))).toEqual(['forbidden']);
    expect(state.status()).toBe('forbidden');
    expect(state.rows()).toEqual([]);
    state.load();
    expect(api.list).not.toHaveBeenCalled();
  });

  it('keeps the rows on a 400 or 5xx so the dialog can retry deliberately', () => {
    state.load();
    for (const status of [400, 500]) {
      api.setMemo.and.returnValue(throwError(() => httpError(status, status === 400 ? 'LONG_ABSENCE_INVALID_REQUEST' : undefined)));
      api.list.calls.reset();
      expect(write(state.setMemo(state.rows()[1], 'x'))).toEqual(['failed']);
      expect(api.list).not.toHaveBeenCalled();
      expect(state.totalCount()).toBe(3);
    }
  });

  it('reports a failed reload after a successful write as such, keeping the saved row', () => {
    state.load();
    const row = state.rows()[0];
    const failures: unknown[] = [];
    state.refreshFailed$.subscribe(() => failures.push(1));
    api.setContactStatus.and.returnValue(of({ ...row, contacted: true, version: 1 }));
    api.list.and.returnValue(throwError(() => httpError(500)));
    expect(write(state.setContacted(row, true))).toEqual(['saved']);
    expect(failures.length).toBe(1);
    expect(state.status()).toBe('ready');
    expect(state.rows()[0].contacted).toBeTrue();
  });

  it('ignores a read that was still running when a write started', () => {
    const slow = new Subject<LongAbsence[]>();
    api.list.and.returnValue(slow);
    state.load();
    slow.next(input);
    const stale = new Subject<LongAbsence[]>();
    api.list.and.returnValue(stale);
    state.load();
    const row = state.rows()[0];
    api.setContactStatus.and.returnValue(of({ ...row, contacted: true, version: 1 }));
    api.list.and.returnValue(of([{ ...row, contacted: true, version: 1 }]));
    write(state.setContacted(row, true));
    stale.next(input);
    expect(state.rows()[0].contacted).toBeTrue();
  });
});
