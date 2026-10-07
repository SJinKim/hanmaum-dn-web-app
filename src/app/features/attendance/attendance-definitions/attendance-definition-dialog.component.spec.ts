import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Select } from 'primeng/select';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { AttendanceService } from '../attendance.service';
import { DefinitionDto } from '../attendance.model';
import { AttendanceDefinitionDialogComponent } from './attendance-definition-dialog.component';

const DEF: DefinitionDto = {
  publicId: 'd1', title: '주일 예배', dayOfWeek: 'SUNDAY',
  windowStart: '09:00:00', windowEnd: '10:30:00', isActive: true, description: '본당',
};

describe('AttendanceDefinitionDialogComponent', () => {
  let service: jasmine.SpyObj<AttendanceService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<AttendanceService>('AttendanceService', ['createDefinition', 'updateDefinition']);
    TestBed.configureTestingModule({
      imports: [AttendanceDefinitionDialogComponent],
      providers: [{ provide: AttendanceService, useValue: service }, provideTranslateService({ fallbackLang: 'ko' })],
    });
  });

  function make(definition: DefinitionDto | null = null) {
    const fixture = TestBed.createComponent(AttendanceDefinitionDialogComponent);
    fixture.componentRef.setInput('definition', definition);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    return fixture;
  }

  it('fills the form from the definition with HH:mm times', () => {
    const c = make(DEF).componentInstance;
    expect(c.isEdit()).toBeTrue();
    expect(c.form.getRawValue()).toEqual({
      title: '주일 예배', description: '본당', dayOfWeek: 'SUNDAY',
      isActive: true, windowStart: '09:00', windowEnd: '10:30',
    });
  });

  it('rejects an end that is not after the start', () => {
    const c = make().componentInstance;
    c.form.patchValue({ title: 'x', dayOfWeek: 'MONDAY', windowStart: '10:00', windowEnd: '10:00' });
    expect(c.endNotAfterStart()).toBeTrue();
    c.submit();
    expect(service.createDefinition).not.toHaveBeenCalled();
  });

  it('creates with trimmed text, HH:mm:ss times and a null empty 설명', () => {
    service.createDefinition.and.returnValue(of(DEF));
    const c = make().componentInstance;
    const saved: DefinitionDto[] = [];
    c.saved.subscribe(d => saved.push(d));

    c.form.patchValue({ title: '  수요 예배 ', description: '  ', dayOfWeek: 'WEDNESDAY', windowStart: '19:30', windowEnd: '21:00' });
    c.submit();

    expect(service.createDefinition).toHaveBeenCalledWith({
      title: '수요 예배', description: null, dayOfWeek: 'WEDNESDAY',
      windowStart: '19:30:00', windowEnd: '21:00:00', isActive: true,
    });
    expect(saved).toEqual([DEF]);
    expect(c.visible()).toBeFalse();
  });

  it('updates the edited definition, including 비활성', () => {
    service.updateDefinition.and.returnValue(of({ ...DEF, isActive: false }));
    const c = make(DEF).componentInstance;
    c.form.patchValue({ isActive: false });
    c.submit();
    expect(service.updateDefinition).toHaveBeenCalledWith('d1', jasmine.objectContaining({
      title: '주일 예배', description: '본당', isActive: false, windowStart: '09:00:00',
    }));
  });

  it('keeps the dialog open and emits failed on error', () => {
    service.createDefinition.and.returnValue(throwError(() => new Error('500')));
    const c = make().componentInstance;
    let failed = 0;
    c.failed.subscribe(() => failed++);
    c.form.patchValue({ title: 'x', dayOfWeek: 'MONDAY', windowStart: '09:00', windowEnd: '10:00' });
    c.submit();
    expect(failed).toBe(1);
    expect(c.visible()).toBeTrue();
    expect(c.saving()).toBeFalse();
  });

  describe('window overlap (#190)', () => {
    const conflict = { publicId: 'd0', title: '1부 예배', dayOfWeek: 'SUNDAY', windowStart: '07:30:00', windowEnd: '09:30:00' };

    function overlap(conflictingDefinition: unknown = conflict) {
      return new HttpErrorResponse({
        status: 409,
        error: { status: 409, error: 'Conflict', message: '겹칩니다', code: 'ATTENDANCE_WINDOW_OVERLAP', conflictingDefinition },
      });
    }

    function submitOverlapping(error: HttpErrorResponse) {
      TestBed.inject(TranslateService).setTranslation('ko', {
        attendance: {
          days: { SUNDAY: '일요일' },
          dialog: { overlap: '「{{title}}」({{day}} {{start}}–{{end}})', overlapGeneric: '겹침' },
        },
      });
      TestBed.inject(TranslateService).use('ko');
      service.createDefinition.and.returnValue(throwError(() => error));
      const fixture = make();
      const c = fixture.componentInstance;
      let failed = 0;
      c.failed.subscribe(() => failed++);
      c.form.patchValue({ title: '주일 2부 예배', dayOfWeek: 'SUNDAY', windowStart: '08:00', windowEnd: '09:00' });
      c.submit();
      fixture.detectChanges();
      return { fixture, c, failed: () => failed };
    }

    it('names the conflicting definition inline and keeps the dialog open without a toast', () => {
      const { fixture, c, failed } = submitOverlapping(overlap());
      expect(c.overlapMessage()).toBe('「1부 예배」(일요일 07:30–09:30)');
      expect(failed()).toBe(0);
      expect(c.visible()).toBeTrue();
      expect(c.saving()).toBeFalse();

      const el = (fixture.nativeElement.ownerDocument as Document);
      expect(el.querySelector('[data-testid="overlap-error"]')?.textContent?.trim()).toBe('「1부 예배」(일요일 07:30–09:30)');
      expect(el.querySelector('#definition-start')?.classList).toContain('ng-invalid');
      expect(el.querySelector('#definition-end')?.classList).toContain('ng-invalid');
    });

    it('falls back to a generic message when the server names no definition', () => {
      const { c } = submitOverlapping(overlap(null));
      expect(c.overlapMessage()).toBe('겹침');
    });

    it('clears the message once a time or the 요일 changes', () => {
      for (const patch of [{ windowStart: '10:00' }, { windowEnd: '11:00' }, { dayOfWeek: 'MONDAY' as const }]) {
        const { c } = submitOverlapping(overlap());
        expect(c.overlap()).not.toBeNull();
        c.form.patchValue(patch);
        expect(c.overlap()).toBeNull();
      }
    });

    it('still emits failed for any other 409', () => {
      const { c, failed } = submitOverlapping(new HttpErrorResponse({ status: 409, error: { code: 'CONFLICT' } }));
      expect(c.overlap()).toBeNull();
      expect(failed()).toBe(1);
    });
  });

  // #145: picking a 요일 used to clear everything typed so far, because the
  // reset effect also tracked the select's own model signal.
  it('keeps typed fields when a 요일 is picked', async () => {
    const fixture = TestBed.createComponent(AttendanceDefinitionDialogComponent);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const c = fixture.componentInstance;
    c.form.patchValue({ title: '수요 예배', description: '본당', isActive: false, windowStart: '19:30', windowEnd: '21:00' });
    fixture.detectChanges();

    const select = fixture.debugElement.query(By.directive(Select)).componentInstance as Select;
    select.updateModel('WEDNESDAY', new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(c.form.getRawValue()).toEqual({
      title: '수요 예배', description: '본당', dayOfWeek: 'WEDNESDAY',
      isActive: false, windowStart: '19:30', windowEnd: '21:00',
    });
  });

  it('starts empty again when reopened for 추가', () => {
    const fixture = make();
    const c = fixture.componentInstance;
    c.form.patchValue({ title: 'x' });
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(c.form.controls.title.value).toBe('');
  });
});
