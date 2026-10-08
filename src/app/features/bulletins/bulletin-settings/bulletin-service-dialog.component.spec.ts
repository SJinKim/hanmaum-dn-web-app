import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { BulletinService } from '../bulletins.model';
import { BulletinsService } from '../bulletins.service';
import { BulletinServiceDialogComponent } from './bulletin-service-dialog.component';

const SERVICE: BulletinService = {
  publicId: 's3', name: '3부 예배', startTime: '14:00:00', sortOrder: 3, active: true, isBulletinDefault: true,
};

describe('BulletinServiceDialogComponent — 예배 추가 / 수정 (#194)', () => {
  let service: jasmine.SpyObj<BulletinsService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<BulletinsService>('BulletinsService', ['createService', 'updateService']);
    TestBed.configureTestingModule({
      imports: [BulletinServiceDialogComponent],
      providers: [{ provide: BulletinsService, useValue: service }, provideTranslateService({ fallbackLang: 'ko' })],
    });
  });

  function make(bulletinService: BulletinService | null = null, nextSortOrder = 4) {
    const fixture = TestBed.createComponent(BulletinServiceDialogComponent);
    fixture.componentRef.setInput('bulletinService', bulletinService);
    fixture.componentRef.setInput('nextSortOrder', nextSortOrder);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('fills the form from the service with an HH:mm time', () => {
    const c = make(SERVICE);
    expect(c.isEdit()).toBeTrue();
    expect(c.form.getRawValue()).toEqual({ name: '3부 예배', startTime: '14:00', active: true, isBulletinDefault: true });
  });

  it('does not submit without 이름 and 시작 시간', () => {
    const c = make();
    c.submit();
    expect(service.createService).not.toHaveBeenCalled();
    expect(c.hasError('name')).toBeTrue();
    expect(c.hasError('startTime')).toBeTrue();
  });

  it('does not submit a whitespace-only 이름', () => {
    const c = make();
    c.form.patchValue({ name: '   ', startTime: '16:30' });
    c.submit();
    expect(service.createService).not.toHaveBeenCalled();
    expect(c.hasError('name')).toBeTrue();
  });

  it('creates with a trimmed name, HH:mm:ss and the next sortOrder', () => {
    service.createService.and.returnValue(of(SERVICE));
    const c = make();
    const saved: BulletinService[] = [];
    c.saved.subscribe(s => saved.push(s));

    c.form.patchValue({ name: '  4부 예배 ', startTime: '16:30' });
    c.submit();

    expect(service.createService).toHaveBeenCalledWith({
      name: '4부 예배', startTime: '16:30:00', sortOrder: 4, active: true, isBulletinDefault: false,
    });
    expect(saved).toEqual([SERVICE]);
    expect(c.visible()).toBeFalse();
  });

  it('updates and keeps the existing sortOrder', () => {
    service.updateService.and.returnValue(of(SERVICE));
    const c = make(SERVICE);
    c.form.patchValue({ active: false });
    c.submit();
    expect(service.updateService).toHaveBeenCalledWith('s3', {
      name: '3부 예배', startTime: '14:00:00', sortOrder: 3, active: false, isBulletinDefault: true,
    });
  });

  it('emits failed and stays open when saving fails', () => {
    service.createService.and.returnValue(throwError(() => new Error('boom')));
    const c = make();
    let failed = 0;
    c.failed.subscribe(() => failed++);
    c.form.patchValue({ name: '4부 예배', startTime: '16:30' });
    c.submit();
    expect(failed).toBe(1);
    expect(c.visible()).toBeTrue();
    expect(c.saving()).toBeFalse();
  });
});
