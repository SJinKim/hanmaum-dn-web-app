import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService, MessageService } from 'primeng/api';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { NewcomerEditComponent } from './newcomer-edit.component';
import { NewcomerService } from '../newcomer.service';
import { newcomerFixture } from '../newcomer-test-data';
import { NewcomerOptions } from '../../../core/models/newcomer.model';

describe('NewcomerEditComponent', () => {
  let service: jasmine.SpyObj<NewcomerService>;

  function setup(publicId: string | null) {
    service = jasmine.createSpyObj<NewcomerService>('NewcomerService', [
      'getOptions', 'getNewcomer', 'createNewcomer', 'updateNewcomer', 'refreshCounts', 'loadNewcomers',
    ]);
    service.getOptions.and.returnValue(of({
      caregivers: [{ publicId: 'c-1', label: 'John Doe' }],
      groups: [{ publicId: 'g-1', label: '1순' }],
      identityStatuses: [],
      attendanceStatuses: [],
    } as NewcomerOptions));
    service.getNewcomer.and.returnValue(of(newcomerFixture()));

    TestBed.configureTestingModule({
      imports: [NewcomerEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'en' }),
        ConfirmationService,
        { provide: NewcomerService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(publicId ? { publicId } : {}) } } },
      ],
    });
    const fixture = TestBed.createComponent(NewcomerEditComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(messages, 'add');
    return { fixture, component: fixture.componentInstance, router, messages };
  }

  function fillRequired(component: NewcomerEditComponent) {
    component.form.patchValue({
      lastName: ' 홍 ',
      firstName: '길동',
      birthDate: new Date(2000, 4, 17),
      phoneCountry: 'DE',
      phoneLocal: '151 12345678',
    });
    component.onGenderChange('M');
  }

  it('creates without a version and opens the new detail', () => {
    const { component, router } = setup(null);
    service.createNewcomer.and.returnValue(of(newcomerFixture({ publicId: 'n-new' })));
    fillRequired(component);

    component.save();

    const request = service.createNewcomer.calls.mostRecent().args[0];
    expect(request.lastName).toBe('홍');
    expect(request.gender).toBe('M');
    expect(request.birthDate).toBe('2000-05-17');
    expect(request.phoneNumber).toBe('+4915112345678');
    expect('version' in request).toBeFalse();
    expect(service.refreshCounts).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/newcomers', 'n-new']);
  });

  it('defaults 등록일 to today on create', () => {
    const { component } = setup(null);
    const date = component.form.get('registrationDate')!.value as Date;
    expect(date.toDateString()).toBe(new Date().toDateString());
    expect(component.hasUnsavedChanges()).toBeFalse();
  });

  it('patches the form in edit mode and sends the version', () => {
    const { component } = setup('n-1');
    service.updateNewcomer.and.returnValue(of(newcomerFixture()));

    expect(component.isEdit()).toBeTrue();
    expect(component.form.get('firstName')!.value).toBe('길동');
    expect(component.form.get('caregiverPublicId')!.value).toBe('c-1');
    expect(component.gender()).toBe('M');

    component.save();

    const [id, request] = service.updateNewcomer.calls.mostRecent().args;
    expect(id).toBe('n-1');
    expect(request.version).toBe(4);
  });

  it('shows the conflict toast on 409', () => {
    const { component, messages, router } = setup('n-1');
    service.updateNewcomer.and.returnValue(throwError(() => ({ status: 409 })));

    component.save();

    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'error', detail: 'newcomers.form.toast.conflict',
    }));
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.saving()).toBeFalse();
  });

  it('does not call the service while the form is invalid', () => {
    const { component } = setup(null);
    component.save();
    expect(service.createNewcomer).not.toHaveBeenCalled();
    expect(component.isInvalid('lastName')).toBeTrue();
  });

  it('shows not found when the newcomer cannot be loaded', () => {
    const { component } = setup('missing');
    service.getNewcomer.and.returnValue(throwError(() => ({ status: 404 })));
    component.ngOnInit();
    expect(component.notFound()).toBeTrue();
  });

  it('syncs the segmented gender control into the form', () => {
    const { component } = setup(null);
    component.onGenderChange('F');
    expect(component.form.get('gender')!.value).toBe('F');
    expect(component.hasUnsavedChanges()).toBeTrue();
  });
});
