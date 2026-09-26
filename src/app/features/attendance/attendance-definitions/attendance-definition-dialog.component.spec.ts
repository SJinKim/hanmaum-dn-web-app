import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
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
});
