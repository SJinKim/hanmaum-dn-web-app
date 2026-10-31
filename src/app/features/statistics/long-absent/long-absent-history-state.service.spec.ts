import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { longAbsenceHistoryItemFixture, pageFixture } from '../../../core/models/long-absent.fixtures.spec';
import { LongAbsenceHistoryItem, LongAbsencePage } from '../../../core/models/long-absent.model';
import { LongAbsentApi } from '../../../core/services/long-absent-api.service';
import { LongAbsentHistoryState } from './long-absent-history-state.service';

describe('LongAbsentHistoryState (#279)', () => {
  let api: jasmine.SpyObj<LongAbsentApi>;
  let state: LongAbsentHistoryState;

  const item = (n: number) =>
    longAbsenceHistoryItemFixture({ phasePublicId: `00000000-0000-4000-8000-0000000000c${n}`, fullName: `John Doe ${n}` });

  beforeEach(() => {
    api = jasmine.createSpyObj<LongAbsentApi>('LongAbsentApi', ['history']);
    TestBed.configureTestingModule({ providers: [LongAbsentHistoryState, { provide: LongAbsentApi, useValue: api }] });
    state = TestBed.inject(LongAbsentHistoryState);
  });

  it('stays idle until loaded, then shows the page with the server totals', () => {
    expect(state.status()).toBe('idle');
    api.history.and.returnValue(of(pageFixture([item(1), item(2)], { totalElements: 42, totalPages: 3 })));
    state.load();
    expect(api.history).toHaveBeenCalledOnceWith(0);
    expect(state.status()).toBe('ready');
    expect(state.items().length).toBe(2);
    expect(state.totalElements()).toBe(42);
    expect(state.totalPages()).toBe(3);
  });

  it('loads another page on request and goes back to the first after a write', () => {
    api.history.and.callFake(page => of(pageFixture([item(page)], { page, totalElements: 41, totalPages: 3 })));
    state.load();
    state.load(2);
    expect(state.page()).toBe(2);
    state.reload();
    expect(api.history.calls.mostRecent().args).toEqual([0]);
    expect(state.page()).toBe(0);
  });

  it('falls back to the last page when the asked one ran past the end', () => {
    api.history.and.callFake(page =>
      of(page === 3 ? pageFixture<LongAbsenceHistoryItem>([], { page: 3, totalElements: 21, totalPages: 2 }) : pageFixture([item(1)], { page, totalElements: 21, totalPages: 2 })),
    );
    state.load(3);
    expect(api.history.calls.allArgs()).toEqual([[3], [1]]);
    expect(state.page()).toBe(1);
    expect(state.items().length).toBe(1);
  });

  it('shows an error, and on 403 drops everything and stops asking', () => {
    api.history.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    state.load();
    expect(state.status()).toBe('error');

    api.history.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    state.load();
    expect(state.status()).toBe('forbidden');
    state.load();
    state.reload();
    expect(api.history).toHaveBeenCalledTimes(2);
  });

  it('lets a newer page overtake an older answer', () => {
    const slow = new Subject<LongAbsencePage<LongAbsenceHistoryItem>>();
    api.history.and.returnValues(slow, of(pageFixture([item(2)], { page: 1, totalElements: 21, totalPages: 2 })));
    state.load(0);
    state.load(1);
    slow.next(pageFixture([item(1)]));
    expect(state.page()).toBe(1);
    expect(state.items()[0].fullName).toBe('John Doe 2');
  });
});
