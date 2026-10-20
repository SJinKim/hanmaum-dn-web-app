import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RoleService } from '../../core/services/role.service';
import { GuideAttendanceDraft, GuideAttendanceService } from './guide-attendance.service';
import { guideEntryTotal, guideSum } from './guide-details.model';
import { guideDateValue } from './guide-report.model';
import { areaFixture, detailFixture } from './guide-details.fixtures.spec';
import { reportFixture } from './guide-report.fixtures.spec';

const base = '/api/v1/guide/worship-counts';
const areaUrl = '/api/v1/guide/counting-areas';
describe('Guide detailed attendance state', () => {
  let state: GuideAttendanceService, http: HttpTestingController, writable: boolean;
  beforeEach(() => {
    writable = true;
    TestBed.configureTestingModule({ providers: [GuideAttendanceService, provideHttpClient(), provideHttpClientTesting(),
      { provide: RoleService, useValue: { canWrite: () => writable } }] });
    state = TestBed.inject(GuideAttendanceService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function configuration(areas = [areaFixture], active = true) {
    http.expectOne(areaUrl).flush({ success: true, data: areas.map(area => ({ ...area, active, version: 0 })) });
    http.expectOne(areaUrl + '/rooms').flush({ success: true, data: [{ publicId: 'room', name: 'Current name', floorPublicId: 'f', floorName: '1F' }] });
  }
  function loadNew(areas = [areaFixture]) { state.load(null); configuration(areas); state.form.controls.serviceDate.setValue(guideDateValue('2026-10-25')); }
  function counts() { return state.form.controls.entries.controls; }
  it('creates three rows per eligible area, with 7 numeric values per area and no implicit zeros', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ ...areaFixture, areaPublicId: 'area-' + i, label: 'Area ' + i, displayOrder: i }));
    loadNew(five); expect(counts().length).toBe(15); expect(state.areas().length).toBe(5); expect(state.sum('totalCount')).toBeNull();
    counts()[0].controls.adultCount.setValue('0'); state.form.controls.notes.setValue('first\nsecond');
    state.save().subscribe(); const request = http.expectOne(base + '/details');
    expect(request.request.method).toBe('POST'); expect(request.request.body.entries.length).toBe(15);
    expect(request.request.body.entries[0]).toEqual({ areaPublicId: 'area-0', serviceNumber: 1, adultCount: 0, schoolCount: null, youthCount: null });
    expect(request.request.body.notes).toBe('first\nsecond'); expect(request.request.body.version).toBeUndefined();
    expect(request.request.body.totalCount).toBeUndefined(); request.flush({ success: true, data: detailFixture() });
    expect(state.form.pristine).toBeTrue(); expect(state.saving()).toBeFalse();
  });
  it('counts third-service young adults exactly once and propagates unknown values', () => {
    loadNew(); for (const row of counts()) row.patchValue({ adultCount: '0', schoolCount: '0', youthCount: row.controls.serviceNumber.value === 3 ? '0' : '' });
    counts()[2].patchValue({ adultCount: '40', youthCount: '25', schoolCount: '5' });
    expect(state.rowTotal('a', 3)).toBe(70); expect(state.sum('compatibleAdultCount', 'a', 3)).toBe(65);
    expect(state.sum('youthCount')).toBe(25); expect(state.sum('totalCount')).toBe(70); expect(state.sum('compatibleAdultCount')).toBe(65);
    counts()[2].controls.youthCount.setValue(''); expect(state.rowTotal('a', 3)).toBeNull(); expect(state.sum('totalCount')).toBeNull();
    expect(guideSum([0, 0])).toBe(0); expect(guideEntryTotal({ areaPublicId: 'a', serviceNumber: 1, adultCount: 0, schoolCount: 0, youthCount: null })).toBe(0);
  });
  it('edits only the stored snapshot, with UUIDs and original version, without requesting current areas', () => {
    state.load('a'); http.expectOne(base + '/a/details').flush({ success: true, data: detailFixture() });
    expect(state.areas()[0].label).toBe('Original A'); http.expectNone(areaUrl);
    counts()[2].controls.youthCount.setValue('26'); state.form.markAsDirty(); state.save().subscribe({ error: () => undefined });
    const request = http.expectOne(base + '/a/details'); expect(request.request.method).toBe('PUT'); expect(request.request.body.version).toBe(3);
    expect(request.request.body.entries[2].youthCount).toBe(26); expect(request.request.body.expectedSummary).toBeUndefined();
    expect(request.request.body.entries[0].roomName).toBeUndefined();
    request.flush({}, { status: 409, statusText: 'Conflict' }); expect(state.failure()).toBe('conflict'); expect(state.form.dirty).toBeTrue();
    expect(counts()[2].controls.youthCount.value).toBe('26'); expect(state.source()?.report.version).toBe(3);
    state.save().subscribe(); http.expectNone(base + '/a/details');
  });
  it('preserves counts by UUID on reordering, renaming and adding areas; removed values require explicit resolution', () => {
    const b = { ...areaFixture, areaPublicId: 'b', displayOrder: 1 }; loadNew([areaFixture, b]);
    counts()[0].controls.adultCount.setValue('123'); counts()[3].controls.adultCount.setValue('456'); state.form.markAsDirty();
    state.load(null); configuration([{ ...b, label: 'Renamed B', displayOrder: 0 }, { ...areaFixture, displayOrder: 1 }, { ...areaFixture, areaPublicId: 'c', displayOrder: 2 }]);
    expect(counts()[state.rowIndex('a', 1)].controls.adultCount.value).toBe('123'); expect(counts()[state.rowIndex('b', 1)].controls.adultCount.value).toBe('456');
    expect(counts()[state.rowIndex('c', 1)].controls.adultCount.value).toBe('');
    state.load(null); configuration([b]); expect(state.removedAreas().map(a => a.areaPublicId)).toEqual(['a']);
    state.save().subscribe(); http.expectNone(base + '/details'); expect(counts()[state.rowIndex('a', 1)].controls.adultCount.value).toBe('123');
    state.discardRemoved(); expect(state.rowIndex('a', 1)).toBe(-1); expect(counts()[state.rowIndex('b', 1)].controls.adultCount.value).toBe('456');
  });
  it('retains even invalid raw text when refreshing configuration', () => {
    loadNew(); counts()[0].controls.adultCount.setValue('1e2'); state.load(null); configuration();
    expect(counts()[0].controls.adultCount.value).toBe('1e2'); state.save().subscribe(); http.expectNone(base + '/details');
  });
  it('keeps a draft across the explicit configuration navigation flow', () => {
    loadNew(); counts()[2].controls.youthCount.setValue('99'); state.form.markAsDirty(); state.keepDraft();
    const resumed = TestBed.runInInjectionContext(() => new GuideAttendanceService()); resumed.load(null); configuration();
    expect(resumed.form.controls.entries.at(2).controls.youthCount.value).toBe('99'); expect(resumed.form.dirty).toBeTrue();
    expect(TestBed.inject(GuideAttendanceDraft).value).toBeNull();
  });
  it('never falls back to current configuration for summary-only or failed detail reads', () => {
    state.load('a'); http.expectOne(base + '/a/details').flush({ success: true, data: { ...detailFixture(), report: reportFixture } });
    expect(state.loadFailed()).toBeTrue(); http.expectNone(areaUrl); state.save().subscribe(); http.expectNone(base + '/details');
    state.load('a'); http.expectOne(base + '/a/details').flush({}, { status: 404, statusText: 'Not Found' });
    expect(state.failure()).toBe('notFound'); expect(state.loadFailed()).toBeTrue();
  });
  it('rejects fractional, exponent, negative and overflowing base/service counts', () => {
    loadNew(); for (const invalid of ['-1', '1.5', '1e2', '2147483648']) { counts()[0].controls.adultCount.setValue(invalid); state.save().subscribe(); http.expectNone(base + '/details'); }
    counts()[0].patchValue({ adultCount: '2147483647', schoolCount: '1' }); expect(state.overflow()).toBeTrue();
    state.save().subscribe(); http.expectNone(base + '/details');
  });
  it('preserves input on configuration failures and maps bracketed server field errors', () => {
    loadNew(); counts()[0].controls.adultCount.setValue('12'); state.save().subscribe({ error: () => undefined });
    http.expectOne(base + '/details').flush({ data: { fieldErrors: { 'entries[0].adultCount': 'invalid' } } }, { status: 400, statusText: 'Bad Request' });
    expect(state.fieldInvalid('entries.0.adultCount')).toBeTrue(); expect(counts()[0].controls.adultCount.value).toBe('12');
    state.load(null); http.expectOne(areaUrl).flush({}, { status: 500, statusText: 'Error' });
    const canceled = http.match(areaUrl + '/rooms'); expect(canceled.length).toBe(1); expect(canceled[0].cancelled).toBeTrue();
    expect(state.loadFailed()).toBeTrue(); expect(counts()[0].controls.adultCount.value).toBe('12');
  });
  it('denies imperative writes for viewers and allows fixing an occupied date without replacing another report', () => {
    loadNew(); writable = false; state.save().subscribe(); http.expectNone(base + '/details'); writable = true;
    state.save().subscribe({ error: () => undefined }); http.expectOne(base + '/details').flush({ detail: 'An active report already exists for this date.' }, { status: 409, statusText: 'Conflict' });
    expect(state.failure()).toBe('dateConflict'); state.form.controls.serviceDate.setValue(guideDateValue('2026-11-01')); expect(state.failure()).toBeNull();
    state.save().subscribe(); http.expectOne(base + '/details').flush({ success: true, data: detailFixture() });
  });
});
