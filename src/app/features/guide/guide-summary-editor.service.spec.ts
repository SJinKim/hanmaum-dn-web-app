import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RoleService } from '../../core/services/role.service';
import { GuideSummaryEditorService } from './guide-summary-editor.service';
import { guideDateValue } from './guide-report.model';
import { previousFixture, reportFixture, reportPage } from './guide-report.fixtures.spec';

const base = '/api/v1/guide/worship-counts';
describe('Guide summary editor state', () => {
  let state: GuideSummaryEditorService, http: HttpTestingController, writable: boolean;
  beforeEach(() => {
    writable = true;
    TestBed.configureTestingModule({ providers: [GuideSummaryEditorService, provideHttpClient(), provideHttpClientTesting(),
      { provide: RoleService, useValue: { canWrite: () => writable } }] });
    state = TestBed.inject(GuideSummaryEditorService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function load(report = reportFixture) {
    state.load(report.publicId); http.expectOne(base + '/a').flush({ success: true, data: report });
    if (report.reportMode === 'SUMMARY_ONLY') http.expectOne(r => r.params.get('from') === '2026-10-11')
      .flush({ success: true, data: reportPage([previousFixture]) });
  }
  it('sends only summary fields and original version, preserving null, zero and note newlines', () => {
    load(); expect(state.totalPreview()).toBe(716); expect(state.deltaPreview()).toBe(63);
    state.form.patchValue({ service1Count: '', service2Count: '0', notes: 'first\nsecond' }); state.form.markAsDirty();
    state.save().subscribe(); const request = http.expectOne(base + '/a');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ serviceDate: '2026-10-18', service1Count: null, service2Count: 0,
      service3Count: 146, notes: 'first\nsecond', version: 3 });
    expect(state.saving()).toBeTrue();
    request.flush({ success: true, data: { ...reportFixture, version: 4, totalCount: null } });
    expect(state.form.pristine).toBeTrue(); expect(state.saving()).toBeFalse(); expect(state.source()?.version).toBe(4);
  });
  it('keeps original values and version after stale conflict and refuses blind retries', () => {
    load(); state.form.controls.service1Count.setValue('777'); state.form.markAsDirty();
    state.save().subscribe({ error: () => undefined }); http.expectOne(base + '/a').flush({}, { status: 409, statusText: 'Conflict' });
    expect(state.failure()).toBe('conflict'); expect(state.form.controls.service1Count.value).toBe('777');
    expect(state.source()?.version).toBe(3); expect(state.form.dirty).toBeTrue();
    state.save().subscribe(); http.expectNone(base + '/a');
  });
  it('allows a corrected duplicate date, preserving the original expected version', () => {
    load(); state.save().subscribe({ error: () => undefined });
    http.expectOne(base + '/a').flush({ detail: 'An active report already exists for this date.' }, { status: 409, statusText: 'Conflict' });
    expect(state.failure()).toBe('dateConflict'); expect(state.fieldInvalid('serviceDate')).toBeTrue();
    state.form.controls.serviceDate.setValue(guideDateValue('2026-10-25'));
    http.expectOne(r => r.params.get('from') === '2026-10-18').flush({ success: true, data: reportPage([reportFixture]) });
    state.save().subscribe(); const request = http.expectOne(base + '/a'); expect(request.request.body.version).toBe(3);
    expect(request.request.body.serviceDate).toBe('2026-10-25'); request.flush({ success: true, data: { ...reportFixture, version: 4 } });
  });
  it('never patches DETAILED mode or bypasses write permissions', () => {
    load({ ...reportFixture, reportMode: 'DETAILED' }); state.save().subscribe(); http.expectNone(base + '/a');
    expect(state.form.disabled).toBeTrue(); writable = false; load(); expect(state.form.disabled).toBeTrue();
    state.save().subscribe(); http.expectNone(base + '/a');
  });
  it('rejects invalid numeric text and missing dates without a request', () => {
    load();
    for (const value of ['-1', '1.2', '1e3', 'NaN', '2147483648']) {
      state.form.controls.service1Count.setValue(value); state.save().subscribe(); http.expectNone(base + '/a');
      expect(state.fieldInvalid('service1Count')).toBeTrue(); expect(state.totalPreview()).toBeNull();
    }
    state.form.controls.service1Count.setValue('1'); state.form.controls.serviceDate.setValue(null);
    state.save().subscribe(); http.expectNone(base + '/a'); expect(state.fieldInvalid('serviceDate')).toBeTrue();
  });
  it('surfaces server field errors and clears only the corrected field', () => {
    load(); state.save().subscribe({ error: () => undefined });
    http.expectOne(base + '/a').flush({ fieldErrors: { notes: 'too long', service1Count: 'invalid' } }, { status: 400, statusText: 'Bad Request' });
    expect(state.fieldInvalid('notes')).toBeTrue(); state.form.controls.notes.setValue('fixed');
    expect(state.fieldErrors()['notes']).toBeUndefined(); expect(state.fieldErrors()['service1Count']).toBe('invalid');
  });
  it('does not turn unavailable prior week or failed reads into a zero count', () => {
    state.load('a'); http.expectOne(base + '/a').flush({ success: true, data: reportFixture });
    http.expectOne(r => r.params.has('from')).flush({}, { status: 500, statusText: 'Error' });
    expect(state.previousFailed()).toBeTrue(); expect(state.deltaPreview()).toBeNull(); expect(state.totalPreview()).toBe(716);
    state.load('a'); http.expectOne(base + '/a').flush({}, { status: 404, statusText: 'Not Found' });
    expect(state.loadFailed()).toBeTrue(); expect(state.failure()).toBe('notFound'); expect(state.source()).toBeNull();
  });
});
