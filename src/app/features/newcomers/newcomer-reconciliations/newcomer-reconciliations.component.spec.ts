import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { Reconciliation } from '../../../core/models/reconciliation.model';
import { ReconciliationService } from '../reconciliation.service';
import { NewcomerReconciliationsComponent } from './newcomer-reconciliations.component';

const ITEM: Reconciliation = {
  publicId: 'r-1',
  status: 'OPEN',
  reasons: ['PROFILE_VALUE_CONFLICT'],
  conflictFields: ['phoneNumber', 'zipCode'],
  registrationMember: { publicId: 'm-1', lastName: '홍', firstName: '길동', linked: false },
  candidates: [{ publicId: 'm-2', lastName: '홍', firstName: '길동', linked: true }],
  version: 0,
  createdAt: '2026-10-01T08:00:00Z',
};

const page = (content: Reconciliation[], number = 0, totalPages = 1) => ({
  content,
  totalElements: content.length,
  totalPages,
  number,
  size: 20,
});

describe('NewcomerReconciliationsComponent — 계정 연결 확인 (#45)', () => {
  let service: jasmine.SpyObj<ReconciliationService>;
  let router: Router;

  function create(fail = false) {
    service = jasmine.createSpyObj<ReconciliationService>('ReconciliationService', ['list']);
    service.list.and.returnValue(fail ? throwError(() => ({ status: 500 })) : of(page([ITEM])));
    TestBed.configureTestingModule({
      imports: [NewcomerReconciliationsComponent],
      providers: [
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: ReconciliationService, useValue: service },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(NewcomerReconciliationsComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('loads the open ones first and lists them', () => {
    const { component, el } = create();
    expect(service.list).toHaveBeenCalledWith('OPEN', 0, 20);
    expect(component.total()).toBe(1);
    expect(el.querySelectorAll('[data-testid="reconciliation-row"]').length).toBe(1);
    expect(component.rows()[0].name).toBe('홍길동');
  });

  it('reloads from the first page when the status changes', () => {
    const { component } = create();
    component.select('DISMISSED');
    expect(service.list).toHaveBeenCalledWith('DISMISSED', 0, 20);
    expect(component.status()).toBe('DISMISSED');
  });

  it('appends the next page', () => {
    const { component } = create();
    service.list.and.returnValue(of(page([{ ...ITEM, publicId: 'r-2' }], 1, 2)));
    component.totalPages.set(2);
    component.more();
    expect(service.list).toHaveBeenCalledWith('OPEN', 1, 20);
    expect(component.items().map(i => i.publicId)).toEqual(['r-1', 'r-2']);
  });

  it('opens the comparison by publicId', () => {
    const { component } = create();
    component.open(ITEM);
    expect(router.navigate).toHaveBeenCalledWith(['/newcomers', 'reconciliations', 'r-1']);
  });

  it('shows the error state when loading fails', () => {
    const { component } = create(true);
    expect(component.failed()).toBeTrue();
    expect(component.loading()).toBeFalse();
  });

  it('falls back to the raw value for an unknown reason', () => {
    const { component } = create();
    expect(component.rows()[0].reasons).toBe('PROFILE_VALUE_CONFLICT');
  });
});
