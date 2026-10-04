import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { NewcomerGraduateDialogComponent } from './newcomer-graduate-dialog.component';
import { NewcomerService } from '../newcomer.service';
import { NewcomerGraduation } from '../../../core/models/newcomer.model';

describe('NewcomerGraduateDialogComponent', () => {
  let service: jasmine.SpyObj<NewcomerService>;

  function setup() {
    service = jasmine.createSpyObj<NewcomerService>('NewcomerService', ['graduate']);
    TestBed.configureTestingModule({
      imports: [NewcomerGraduateDialogComponent],
      providers: [
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'en' }),
        MessageService,
        { provide: NewcomerService, useValue: service },
      ],
    });
    const fixture = TestBed.createComponent(NewcomerGraduateDialogComponent);
    fixture.componentRef.setInput('publicId', 'n-1');
    fixture.componentRef.setInput('groups', [{ publicId: 'g-1', label: '1순' }]);
    fixture.componentRef.setInput('initialGroup', 'g-1');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const messages = TestBed.inject(MessageService);
    spyOn(messages, 'add');
    return { fixture, component: fixture.componentInstance, messages };
  }

  it('defaults 등반일 to today and 순 to the current assignment on open', () => {
    const { component } = setup();
    component.onShow();
    const date = component.form.get('graduatedAt')!.value as Date;
    expect(date.toDateString()).toBe(new Date().toDateString());
    expect(component.form.get('groupId')!.value).toBe('g-1');
  });

  it('does not submit without a 순', () => {
    const { component } = setup();
    component.onShow();
    component.form.patchValue({ groupId: null });
    component.submit();
    expect(service.graduate).not.toHaveBeenCalled();
  });

  it('maps the form onto GraduateNewcomerRequest, emits and closes', () => {
    const { component } = setup();
    service.graduate.and.returnValue(of({ publicId: 'gr-1' } as NewcomerGraduation));
    let emitted: NewcomerGraduation | undefined;
    component.graduated.subscribe(g => (emitted = g));

    component.onShow();
    component.form.patchValue({ graduatedAt: new Date(2026, 9, 4), cohortNumber: 3, note: '  친구 소개  ' });
    component.submit();

    expect(service.graduate).toHaveBeenCalledWith('n-1', {
      groupPublicId: 'g-1',
      graduatedAt: '2026-10-04',
      cohortNumber: 3,
      assignmentReason: '친구 소개',
    });
    expect(emitted?.publicId).toBe('gr-1');
    expect(component.visible()).toBeFalse();
  });

  it('leaves cohort and note out when empty', () => {
    const { component } = setup();
    service.graduate.and.returnValue(of({ publicId: 'gr-1' } as NewcomerGraduation));
    component.onShow();
    component.submit();
    const body = service.graduate.calls.mostRecent().args[1];
    expect('cohortNumber' in body).toBeFalse();
    expect('assignmentReason' in body).toBeFalse();
  });

  it('keeps the dialog open and toasts on error', () => {
    const { component, messages } = setup();
    service.graduate.and.returnValue(throwError(() => ({ status: 500 })));
    component.onShow();
    component.submit();
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'error', detail: 'newcomers.graduate.toast.failed',
    }));
    expect(component.visible()).toBeTrue();
    expect(component.saving()).toBeFalse();
  });
});
