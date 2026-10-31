import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  longAbsenceChangeFixture,
  longAbsencePhaseFixture,
  pageFixture,
} from '../../../core/models/long-absent.fixtures.spec';
import { LongAbsentApi } from '../../../core/services/long-absent-api.service';
import { LongAbsentPhaseState, LongAbsentPhaseTarget } from './long-absent-phase-state.service';

const TARGET: LongAbsentPhaseTarget = {
  memberPublicId: '00000000-0000-4000-8000-000000000001',
  phasePublicId: '00000000-0000-4000-8000-0000000000c1',
  fullName: '홍길동',
};

const change = (n: number, memo: string | null = `메모 ${n}`) =>
  longAbsenceChangeFixture({ publicId: `00000000-0000-4000-8000-0000000000d${n}`, revision: n, memo });

describe('LongAbsentPhaseState (#279)', () => {
  let api: jasmine.SpyObj<LongAbsentApi>;
  let state: LongAbsentPhaseState;

  beforeEach(() => {
    api = jasmine.createSpyObj<LongAbsentApi>('LongAbsentApi', ['phase', 'changes']);
    api.phase.and.returnValue(of(longAbsencePhaseFixture()));
    api.changes.and.returnValue(of(pageFixture([change(2), change(1)])));
    TestBed.configureTestingModule({ providers: [LongAbsentPhaseState, { provide: LongAbsentApi, useValue: api }] });
    state = TestBed.inject(LongAbsentPhaseState);
  });

  it('opens with the detail and the first page of changes', () => {
    state.open(TARGET);
    expect(api.phase).toHaveBeenCalledOnceWith(TARGET.memberPublicId, TARGET.phasePublicId);
    expect(api.changes).toHaveBeenCalledOnceWith(TARGET.memberPublicId, TARGET.phasePublicId, 0);
    expect(state.status()).toBe('ready');
    expect(state.phase()?.memo).toBe('직장 때문에 이사');
    expect(state.changes().length).toBe(2);
    expect(state.hasMoreChanges()).toBeFalse();
  });

  it('appends further change pages without duplicates', () => {
    api.changes.and.callFake((_m, _p, page) =>
      of(
        page === 0
          ? pageFixture([change(3), change(2)], { totalElements: 3, totalPages: 2, size: 2 })
          : pageFixture([change(2), change(1)], { page: 1, totalElements: 3, totalPages: 2, size: 2 }),
      ),
    );
    state.open(TARGET);
    expect(state.hasMoreChanges()).toBeTrue();
    state.loadMoreChanges();
    expect(state.changes().map(c => c.revision)).toEqual([3, 2, 1]);
    expect(state.hasMoreChanges()).toBeFalse();
  });

  it('keeps the detail readable when the changes fail (partial failure) and retries only them', () => {
    api.changes.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    state.open(TARGET);
    expect(state.status()).toBe('ready');
    expect(state.changesStatus()).toBe('error');
    api.changes.and.returnValue(of(pageFixture([change(1)])));
    state.retryChanges();
    expect(api.phase).toHaveBeenCalledTimes(1);
    expect(state.changesStatus()).toBe('ready');
  });

  it('tells a missing phase (404) apart from an error', () => {
    api.phase.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    state.open(TARGET);
    expect(state.status()).toBe('notFound');
    api.phase.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    state.retry();
    expect(state.status()).toBe('error');
  });

  it('after a write on the same person drops every loaded memo and reads fresh (AK 4)', () => {
    state.open(TARGET);
    expect(state.changes().some(c => c.memo === '메모 2')).toBeTrue();
    // The memo was cleared: the server now has no text versions any more.
    api.phase.and.returnValue(of(longAbsencePhaseFixture({ memo: null })));
    api.changes.and.returnValue(of(pageFixture([change(3, null)])));
    state.refreshFor(TARGET.memberPublicId);
    expect(state.phase()?.memo).toBeNull();
    expect(state.changes().map(c => c.memo)).toEqual([null]);
  });

  it('ignores writes on other people', () => {
    state.open(TARGET);
    state.refreshFor('00000000-0000-4000-8000-000000000009');
    expect(api.phase).toHaveBeenCalledTimes(1);
  });

  it('forgets everything on close', () => {
    state.open(TARGET);
    state.close();
    expect(state.isOpen()).toBeFalse();
    expect(state.phase()).toBeNull();
    expect(state.changes()).toEqual([]);
    expect(state.status()).toBe('closed');
  });

  it('on 403 drops everything, reports it once and stops asking', () => {
    const events: void[] = [];
    state.forbidden$.subscribe(() => events.push(undefined));
    api.phase.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    api.changes.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    state.open(TARGET);
    expect(state.status()).toBe('forbidden');
    expect(state.isOpen()).toBeFalse();
    expect(events.length).toBe(1);
    state.open(TARGET);
    expect(api.phase).toHaveBeenCalledTimes(1);
  });
});
