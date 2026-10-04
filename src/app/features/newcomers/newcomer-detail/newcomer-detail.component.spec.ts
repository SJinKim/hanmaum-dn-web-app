import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { NewcomerDetailComponent } from './newcomer-detail.component';
import { NewcomerService } from '../newcomer.service';
import { RoleService } from '../../../core/services/role.service';
import { newcomerFixture } from '../newcomer-test-data';
import { NewcomerOptions } from '../../../core/models/newcomer.model';

describe('NewcomerDetailComponent', () => {
  let service: jasmine.SpyObj<NewcomerService>;

  function setup(options: { fail?: boolean; canWrite?: boolean } = {}) {
    service = jasmine.createSpyObj<NewcomerService>('NewcomerService', [
      'getOptions', 'getNewcomer', 'deleteNewcomer', 'refreshCounts', 'loadNewcomers', 'graduate',
    ]);
    service.getOptions.and.returnValue(of({
      caregivers: [],
      groups: [{ publicId: 'g-1', label: '1순' }],
      identityStatuses: [],
      attendanceStatuses: [],
    } as NewcomerOptions));
    service.getNewcomer.and.returnValue(
      options.fail ? throwError(() => ({ status: 404 })) : of(newcomerFixture()));

    TestBed.configureTestingModule({
      imports: [NewcomerDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: NewcomerService, useValue: service },
        { provide: RoleService, useValue: { canWrite: () => options.canWrite ?? true, hasAnyRole: () => true, isAdmin: () => true } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'n-1' }) } } },
      ],
    });
    const fixture = TestBed.createComponent(NewcomerDetailComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    return { fixture, component: fixture.componentInstance, router };
  }

  it('loads the newcomer and the 순 options for writers', () => {
    const { component } = setup();
    expect(service.getNewcomer).toHaveBeenCalledWith('n-1');
    expect(component.newcomer()?.publicId).toBe('n-1');
    expect(component.fullName()).toBe('홍길동');
    expect(component.groups().length).toBe(1);
    expect(component.loading()).toBeFalse();
  });

  it('skips the options for read-only roles', () => {
    setup({ canWrite: false });
    expect(service.getOptions).not.toHaveBeenCalled();
  });

  it('marks the page failed when loading fails', () => {
    const { component } = setup({ fail: true });
    expect(component.failed()).toBeTrue();
    expect(component.newcomer()).toBeNull();
  });

  it('opens the edit route', () => {
    const { component, router } = setup();
    component.goToEdit();
    expect(router.navigate).toHaveBeenCalledWith(['/newcomers', 'n-1', 'edit']);
  });

  it('reloads after 등반', () => {
    const { component } = setup();
    service.getNewcomer.and.returnValue(of(newcomerFixture({ lifecycleStatus: 'GRADUATED' })));

    component.onGraduated();

    expect(service.refreshCounts).toHaveBeenCalled();
    expect(service.loadNewcomers).toHaveBeenCalled();
    expect(component.isGraduated()).toBeTrue();
  });
});
