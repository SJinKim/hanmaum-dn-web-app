import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { GuideHomeSnapshot } from '../../core/models/guide-home.model';
import { GuideHomeApi } from '../../core/services/guide-home-api.service';
import { GuideHomeState } from './guide-home-state.service';
import { guideHomeFixture } from './guide-home.fixtures.spec';

describe('Guide Home refresh lifecycle', () => {
  let api: jasmine.SpyObj<GuideHomeApi>, state: GuideHomeState, requests: Subject<GuideHomeSnapshot>[];
  const visible = (value: string) => Object.defineProperty(document, 'visibilityState', { configurable: true, value });
  beforeEach(() => {
    jasmine.clock().install(); jasmine.clock().mockDate(new Date('2026-10-25T08:00:00Z')); visible('visible');
    requests = []; api = jasmine.createSpyObj<GuideHomeApi>('GuideHomeApi', ['get']);
    api.get.and.callFake(() => { const request = new Subject<GuideHomeSnapshot>(); requests.push(request); return request; });
    TestBed.configureTestingModule({ providers: [GuideHomeState, { provide: GuideHomeApi, useValue: api }] });
    state = TestBed.inject(GuideHomeState);
  });
  afterEach(() => { TestBed.resetTestingModule(); Reflect.deleteProperty(document, 'visibilityState'); jasmine.clock().uninstall(); });
  function respond(index: number, data = guideHomeFixture()): void { requests[index].next(data); requests[index].complete(); }
  it('loads immediately, polls visible church Sundays and refreshes on focus', () => {
    state.start(); expect(api.get).toHaveBeenCalledTimes(1); respond(0);
    jasmine.clock().tick(30000); expect(api.get).toHaveBeenCalledTimes(2); respond(1);
    window.dispatchEvent(new Event('focus')); expect(api.get).toHaveBeenCalledTimes(3);
  });
  it('does not poll weekdays or hidden documents but reloads on visibility return', () => {
    jasmine.clock().mockDate(new Date('2026-10-20T08:00:00Z')); state.start(); respond(0);
    jasmine.clock().tick(60000); expect(api.get).toHaveBeenCalledTimes(1);
    jasmine.clock().mockDate(new Date('2026-10-25T08:00:00Z')); visible('hidden');
    jasmine.clock().tick(30000); expect(api.get).toHaveBeenCalledTimes(1);
    visible('visible'); document.dispatchEvent(new Event('visibilitychange')); expect(api.get).toHaveBeenCalledTimes(2);
  });
  it('detects Sunday rollover while the page remains open', () => {
    jasmine.clock().mockDate(new Date('2026-10-24T21:59:40Z')); state.start(); respond(0);
    jasmine.clock().tick(30000); expect(api.get).toHaveBeenCalledTimes(2);
  });
  it('retains the prior successful snapshot and timestamp after a failed refresh', () => {
    state.start(); respond(0); const previous = state.snapshot(); state.reload(); requests[1].error(new Error('offline'));
    expect(state.snapshot()).toBe(previous); expect(state.failed()).toBeTrue(); expect(state.loading()).toBeFalse();
    state.reload(); respond(2); expect(state.failed()).toBeFalse();
  });
  it('shares an in-flight read with entry checks instead of overlapping requests', () => {
    state.start(); const entry = state.fresh().subscribe(); state.reload();
    expect(api.get).toHaveBeenCalledTimes(1); respond(0); expect(state.snapshot()?.snapshotVersion).toBe('v1'); entry.unsubscribe();
    state.reload(); expect(api.get).toHaveBeenCalledTimes(2);
  });
  it('rejects older responses and stops requests and timers after destruction', () => {
    state.start(); respond(0); state.accept({ ...guideHomeFixture(), asOf: '2026-10-18T00:00:00Z', snapshotVersion: 'old' });
    expect(state.snapshot()?.snapshotVersion).toBe('v1'); state.reload(); expect(requests[1].observed).toBeTrue();
    TestBed.resetTestingModule(); expect(requests[1].observed).toBeFalse(); jasmine.clock().tick(60000);
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
