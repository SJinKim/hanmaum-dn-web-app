import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { Reconciliation } from '../../../core/models/reconciliation.model';
import { RoleService } from '../../../core/services/role.service';
import { ReconciliationService } from '../reconciliation.service';
import { NewcomerReconciliationDetailComponent } from './newcomer-reconciliation-detail.component';

const ITEM: Reconciliation = {
  publicId: 'r-1',
  status: 'OPEN',
  reasons: ['EMAIL_MATCH_IDENTITY_MISMATCH'],
  conflictFields: ['phoneNumber', 'zipCode'],
  registrationMember: {
    publicId: 'm-1', lastName: '홍', firstName: '길동', email: 'john.doe@example.com',
    birthDate: '1990-01-15', phoneNumber: '+491512345678', linked: false,
    emailVerified: null, origin: 'NEWCOMER_FORM',
  },
  candidates: [{
    publicId: 'm-2', lastName: '홍', firstName: '길동', email: 'john.doe@example.com',
    birthDate: '1990-01-15', phoneNumber: '+491700000000', linked: true,
    emailVerified: true, origin: 'APP',
  }],
  version: 3,
  createdAt: '2026-10-01T08:00:00Z',
};

const conflict = (message: string, status = 409) => throwError(() => ({ status, error: { message } }));

describe('NewcomerReconciliationDetailComponent — 계정 연결 확인 비교 (#45)', () => {
  let service: jasmine.SpyObj<ReconciliationService>;

  function create(options: { canWrite?: boolean; item?: Reconciliation; loadStatus?: number } = {}) {
    service = jasmine.createSpyObj<ReconciliationService>('ReconciliationService', ['get', 'link', 'merge', 'dismiss']);
    service.get.and.returnValue(
      options.loadStatus ? throwError(() => ({ status: options.loadStatus })) : of(options.item ?? ITEM),
    );
    TestBed.configureTestingModule({
      imports: [NewcomerReconciliationDetailComponent],
      providers: [
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: ReconciliationService, useValue: service },
        { provide: RoleService, useValue: { canWrite: () => options.canWrite ?? true } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'r-1' }) } } },
      ],
    });
    const fixture = TestBed.createComponent(NewcomerReconciliationDetailComponent);
    const confirm = fixture.debugElement.injector.get(ConfirmationService);
    const confirmations: Confirmation[] = [];
    spyOn(confirm, 'confirm').and.callFake((c: Confirmation) => {
      confirmations.push(c);
      return confirm;
    });
    fixture.detectChanges();
    const accept = () => confirmations[confirmations.length - 1].accept!();
    return { fixture, component: fixture.componentInstance, confirmations, accept, el: fixture.nativeElement as HTMLElement };
  }

  it('puts the registration next to each candidate and marks what differs', () => {
    const { component, el } = create();
    expect(service.get).toHaveBeenCalledWith('r-1');
    expect(component.columns().map(c => c.registration)).toEqual([true, false]);
    const phone = component.rows().find(r => r.field === 'phoneNumber')!;
    expect(phone.cells.map(c => c.differs)).toEqual([false, true]);
    const email = component.rows().find(r => r.field === 'email')!;
    expect(email.cells.some(c => c.differs)).toBeFalse();
    expect(el.querySelectorAll('[data-differs]').length).toBe(1);
  });

  it('names each column with the origin of its member (#182)', () => {
    const { component, el } = create();
    expect(component.columns().map(c => c.origin)).toEqual(['NEWCOMER_FORM', 'APP']);
    const names = Array.from(el.querySelectorAll('[data-testid="column-name"]')).map(n => n.textContent!.trim());
    expect(names[0]).toContain('· NEWCOMER_FORM');
  });

  it('shows email verification only for members with an account (#182)', () => {
    const verificationOf = (candidate: Partial<Reconciliation['candidates'][number]>) => {
      TestBed.resetTestingModule();
      const { component } = create({ item: { ...ITEM, candidates: [{ ...ITEM.candidates[0], ...candidate }] } });
      return component.rows().find(r => r.field === 'email')!.cells.map(c => c.verification);
    };
    expect(verificationOf({})).toEqual([null, 'verified']);
    expect(verificationOf({ emailVerified: false })).toEqual([null, 'unverified']);
    expect(verificationOf({ emailVerified: null })).toEqual([null, 'unknown']);
    expect(verificationOf({ linked: false, emailVerified: null })).toEqual([null, null]);
  });

  it('marks the verified email in the comparison (#182)', () => {
    const { el } = create();
    expect(el.querySelectorAll('[data-testid="email-verification"]').length).toBe(1);
  });

  it('names conflicting fields it cannot show side by side', () => {
    const { component } = create();
    expect(component.hiddenConflicts()).toBe('zipCode');
  });

  it('links after the confirmation with the shown version', () => {
    const { component, accept } = create();
    service.link.and.returnValue(of({ ...ITEM, status: 'LINKED', selectedMemberPublicId: 'm-2' }));
    component.confirmLink(component.columns()[1]);
    expect(service.link).not.toHaveBeenCalled();
    accept();
    expect(service.link).toHaveBeenCalledWith('r-1', { memberPublicId: 'm-2', version: 3 });
    expect(component.item()!.status).toBe('LINKED');
    expect(component.editable()).toBeFalse();
  });

  it('asks again and merges when both sides have 새가족 history', () => {
    const { component, accept, confirmations } = create();
    service.link.and.returnValue(conflict('Both members have newcomer history; use the merge action.'));
    service.merge.and.returnValue(of({ ...ITEM, status: 'LINKED' }));
    component.confirmLink(component.columns()[1]);
    accept();
    expect(confirmations.length).toBe(2);
    expect(service.merge).not.toHaveBeenCalled();
    accept();
    expect(service.merge).toHaveBeenCalledWith('r-1', { memberPublicId: 'm-2', version: 3 });
  });

  it('reloads when the reconciliation changed meanwhile', () => {
    const { component, accept } = create();
    service.link.and.returnValue(conflict('The reconciliation changed. Reload and retry.'));
    component.confirmLink(component.columns()[1]);
    accept();
    expect(service.get).toHaveBeenCalledTimes(2);
  });

  it('keeps the page for an already linked account', () => {
    const { component, accept } = create();
    service.link.and.returnValue(conflict('The selected member is already linked to another account.'));
    component.confirmLink(component.columns()[1]);
    accept();
    expect(service.get).toHaveBeenCalledTimes(1);
    expect(component.busy()).toBeNull();
    expect(component.item()!.status).toBe('OPEN');
  });

  it('dismisses after the confirmation', () => {
    const { component, accept } = create();
    service.dismiss.and.returnValue(of({ ...ITEM, status: 'DISMISSED' }));
    component.confirmDismiss();
    accept();
    expect(service.dismiss).toHaveBeenCalledWith('r-1', 3);
    expect(component.item()!.status).toBe('DISMISSED');
  });

  it('is read-only once resolved', () => {
    const { component, el } = create({ item: { ...ITEM, status: 'LINKED', resolvedAt: '2026-10-02T08:00:00Z' } });
    expect(component.editable()).toBeFalse();
    expect(el.querySelector('[data-testid="dismiss"]')).toBeNull();
    expect(el.querySelector('[data-testid="resolved-at"]')).not.toBeNull();
  });

  it('is read-only without write access', () => {
    const { component, el } = create({ canWrite: false });
    expect(component.editable()).toBeFalse();
    expect(el.querySelector('[data-testid="link-m-2"]')).toBeNull();
  });

  it('shows not found for a 404', () => {
    const { component } = create({ loadStatus: 404 });
    expect(component.failed()).toBe('notFound');
  });
});
