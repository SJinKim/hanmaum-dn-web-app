import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, Subject, throwError } from 'rxjs';

import { RoleService } from '../../../core/services/role.service';
import { BulletinDefaults, BulletinEdition, BulletinEditionSummary } from '../bulletins.model';
import { BulletinsService } from '../bulletins.service';
import { BulletinsListComponent } from './bulletins-list.component';

function summary(overrides: Partial<BulletinEditionSummary> = {}): BulletinEditionSummary {
  return {
    publicId: 'b1',
    serviceDate: '2099-10-11',
    volume: 12,
    status: 'PUBLISHED',
    sermonTitle: '말씀',
    serviceName: '주일 예배',
    publishedAt: '2099-10-10T09:00:00Z',
    ...overrides,
  };
}

const page = (content: BulletinEditionSummary[]) =>
  ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 });

function defaults(overrides: Partial<BulletinDefaults> = {}): BulletinDefaults {
  return {
    serviceDate: '2026-10-11',
    service: { publicId: 's1', name: '3부', startTime: '14:00:00', sortOrder: 3, active: true, isBulletinDefault: true },
    sundays: [
      { serviceDate: '2026-10-11', editionPublicId: null, status: null },
      { serviceDate: '2026-10-18', editionPublicId: 'existing', status: 'DRAFT' },
      { serviceDate: '2026-10-25', editionPublicId: null, status: null },
    ],
    nextFrom: '2027-01-03',
    ...overrides,
  };
}

describe('BulletinsListComponent — 주보 목록 (#36)', () => {
  let service: jasmine.SpyObj<BulletinsService>;

  function setup(options: { canWrite?: boolean; editions?: BulletinEditionSummary[]; fail?: boolean } = {}) {
    service = jasmine.createSpyObj<BulletinsService>('BulletinsService', ['list', 'create', 'delete', 'defaults']);
    service.list.and.returnValue(
      options.fail ? throwError(() => new Error('boom')) : of(page(options.editions ?? [summary()])),
    );

    service.defaults.and.returnValue(of(defaults()));

    TestBed.configureTestingModule({
      imports: [BulletinsListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: BulletinsService, useValue: service },
        { provide: RoleService, useValue: { canWrite: () => options.canWrite ?? true, hasAnyRole: () => true, isAdmin: () => true } },
      ],
    });
    const fixture = TestBed.createComponent(BulletinsListComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(messages, 'add');
    const confirmations = fixture.debugElement.injector.get(ConfirmationService);
    spyOn(confirmations, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmations;
    });
    return { fixture, component: fixture.componentInstance, router, messages, el: fixture.nativeElement as HTMLElement };
  }

  it('lists the editions with VOL and publish date', () => {
    const { component } = setup({
      editions: [summary(), summary({ publicId: 'b2', volume: null, status: 'DRAFT', publishedAt: null })],
    });
    const records = component.records();
    expect(records.length).toBe(2);
    expect(records[0].cells?.['updated']).toBe('2099-10-10');
    expect(records[1].cells?.['volume']).toBe('—');
  });

  it('shows an error state when loading fails', () => {
    const { component, el } = setup({ fail: true });
    expect(component.failed()).toBeTrue();
    expect(el.querySelector('app-empty-state')).not.toBeNull();
  });

  it('copies the newest edition by default and opens the editor', () => {
    const { component, router } = setup();
    service.create.and.returnValue(of({ publicId: 'new' } as BulletinEdition));
    component.openCreate();
    expect(component.createMode()).toBe('copy');
    component.create();

    expect(service.create).toHaveBeenCalledWith({ serviceDate: '2026-10-11', copyFrom: 'b1' });
    expect(router.navigate).toHaveBeenCalledWith(['/bulletins', 'new']);
    expect(component.createVisible()).toBeFalse();
  });

  it('creates a blank draft when there is nothing to copy', () => {
    const { component } = setup({ editions: [] });
    service.create.and.returnValue(of({ publicId: 'new' } as BulletinEdition));
    component.openCreate();
    expect(component.createMode()).toBe('blank');
    component.create();
    expect(service.create).toHaveBeenCalledWith({ serviceDate: '2026-10-11' });
  });

  it('deletes only a draft that never had a VOL', () => {
    const draft = summary({ publicId: 'd1', volume: null, status: 'DRAFT', publishedAt: null });
    const { component } = setup({ editions: [summary(), draft] });
    expect(component.canDelete('b1')).toBeFalse();
    expect(component.canDelete('d1')).toBeTrue();

    service.delete.and.returnValue(of(void 0));
    component.confirmDelete('b1');
    expect(service.delete).not.toHaveBeenCalled();
    component.confirmDelete('d1');
    expect(service.delete).toHaveBeenCalledWith('d1');
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('uses the server suggestion again after deleting the earlier draft, despite the later draft', () => {
    const draft = summary({ publicId: 'earlier', serviceDate: '2026-10-11', volume: null, status: 'DRAFT', publishedAt: null });
    const { component } = setup({ editions: [summary({ serviceDate: '2026-10-18' }), draft] });
    service.delete.and.returnValue(of(void 0));
    component.confirmDelete('earlier');
    component.openCreate();
    expect(service.defaults).toHaveBeenCalledWith(undefined);
    expect(component.selectedDate()).toBe('2026-10-11');
  });

  it('sends the selected free Sunday instead of recalculating it during creation', () => {
    const { component } = setup();
    service.create.and.returnValue(of({ publicId: 'new' } as BulletinEdition));
    component.openCreate();
    component.selectedDate.set('2026-10-25');
    component.create();
    expect(service.create).toHaveBeenCalledWith({ serviceDate: '2026-10-25', copyFrom: 'b1' });
  });

  it('opens an existing draft, published or withdrawn edition without creating a duplicate', () => {
    const { component, router } = setup();
    for (const status of ['DRAFT', 'PUBLISHED', 'WITHDRAWN'] as const) {
      service.defaults.and.returnValue(of(defaults({ sundays: [{ serviceDate: '2026-10-18', editionPublicId: 'existing', status }] })));
      component.openCreate();
      component.selectedDate.set('2026-10-18');
      component.create();
      expect(router.navigate).toHaveBeenCalledWith(['/bulletins', 'existing']);
    }
    expect(service.create).not.toHaveBeenCalled();
  });

  it('blocks creation while Sundays are loading and cancels a request when the dialog closes', () => {
    const { component } = setup();
    const pending = new Subject<BulletinDefaults>();
    service.defaults.and.returnValue(pending);
    component.openCreate();
    component.create();
    expect(component.datesLoading()).toBeTrue();
    expect(service.create).not.toHaveBeenCalled();
    component.closeCreate();
    pending.next(defaults());
    expect(component.selectedDate()).toBeNull();
    expect(component.createVisible()).toBeFalse();
  });

  it('retries a failed date request without creating a draft or losing the creation mode', () => {
    const { component } = setup();
    service.defaults.and.returnValue(throwError(() => new Error('network')));
    component.openCreate();
    component.createMode.set('blank');
    component.create();
    expect(component.datesFailed()).toBeTrue();
    expect(service.create).not.toHaveBeenCalled();
    service.defaults.and.returnValue(of(defaults()));
    component.retryDates();
    expect(component.datesFailed()).toBeFalse();
    expect(component.createMode()).toBe('blank');
    expect(component.selectedDate()).toBe('2026-10-11');
  });

  it('loads further Sundays through the server cursor and keeps the selected date', () => {
    const { component } = setup();
    component.openCreate();
    service.defaults.and.returnValue(of(defaults({
      sundays: [{ serviceDate: '2027-01-03', editionPublicId: null, status: null }],
      nextFrom: '2027-03-28',
    })));
    component.loadMoreDates();
    expect(service.defaults).toHaveBeenCalledWith('2027-01-03');
    expect(component.selectedDate()).toBe('2026-10-11');
    expect(component.dateOptions().some(s => s.serviceDate === '2027-01-03')).toBeTrue();
  });

  it('selects the server suggestion even when it lies beyond the first batch', () => {
    const { component } = setup();
    service.defaults.and.returnValue(of(defaults({ serviceDate: '2027-02-07' })));
    component.openCreate();
    expect(component.selectedSunday()?.serviceDate).toBe('2027-02-07');
  });

  it('refreshes a conflicting Sunday and offers the newly created edition while keeping the mode', () => {
    const { component, router } = setup();
    component.openCreate();
    component.createMode.set('blank');
    service.create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    service.defaults.and.returnValue(of(defaults({
      serviceDate: '2026-10-25',
      sundays: [{ serviceDate: '2026-10-11', editionPublicId: 'racing-edition', status: 'DRAFT' }],
    })));
    component.create();
    expect(service.defaults).toHaveBeenCalledWith('2026-10-11');
    expect(component.createVisible()).toBeTrue();
    expect(component.createMode()).toBe('blank');
    expect(component.selectedSunday()?.editionPublicId).toBe('racing-edition');
    component.create();
    expect(router.navigate).toHaveBeenCalledWith(['/bulletins', 'racing-edition']);
    expect(service.create).toHaveBeenCalledTimes(1);
  });

  it('waits for refreshed evidence before announcing that a Sunday was taken', () => {
    const { component, messages } = setup();
    component.openCreate();
    const pending = new Subject<BulletinDefaults>();
    service.create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    service.defaults.and.returnValue(pending);
    component.create();
    expect(messages.add).not.toHaveBeenCalled();
    pending.next(defaults({ sundays: [{ serviceDate: '2026-10-11', editionPublicId: 'racing', status: 'DRAFT' }] }));
    expect(messages.add).toHaveBeenCalledWith({ severity: 'warn', summary: 'bulletins.create.dateTaken' });
  });

  it('shows a normal create error when a 409 refresh confirms that the Sunday is still free', () => {
    const { component, messages, router } = setup();
    component.openCreate();
    component.createMode.set('blank');
    service.create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    component.create();
    expect(component.selectedSunday()?.editionPublicId).toBeNull();
    expect(component.createMode()).toBe('blank');
    expect(messages.add).toHaveBeenCalledWith({ severity: 'error', summary: 'bulletins.toast.createFailed' });
    expect(messages.add).not.toHaveBeenCalledWith({ severity: 'warn', summary: 'bulletins.create.dateTaken' });
    service.create.and.returnValue(of({ publicId: 'retry-success' } as BulletinEdition));
    component.create();
    expect(router.navigate).toHaveBeenCalledWith(['/bulletins', 'retry-success']);
  });

  it('does not announce a taken date when refreshing after a 409 fails', () => {
    const { component, messages } = setup();
    component.openCreate();
    service.create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    service.defaults.and.returnValue(throwError(() => new Error('network')));
    component.create();
    expect(component.datesFailed()).toBeTrue();
    expect(messages.add).toHaveBeenCalledWith({ severity: 'error', summary: 'bulletins.toast.createFailed' });
    expect(messages.add).not.toHaveBeenCalledWith({ severity: 'warn', summary: 'bulletins.create.dateTaken' });
  });

  it('keeps the described-by live region mounted across asynchronous date loading', () => {
    const { component, fixture } = setup();
    const pending = new Subject<BulletinDefaults>();
    service.defaults.and.returnValue(pending);
    component.openCreate();
    fixture.detectChanges();
    const hint = document.getElementById('bulletin-sunday-hint');
    expect(hint).not.toBeNull();
    expect(hint?.getAttribute('aria-live')).toBe('polite');
    expect(document.getElementById('bulletin-sunday')?.getAttribute('aria-describedby')).toBe('bulletin-sunday-hint');
    expect(document.getElementById('bulletin-sunday')?.getAttribute('aria-labelledby')).toBe('bulletin-sunday-label');
    pending.next(defaults());
    fixture.detectChanges();
    expect(document.getElementById('bulletin-sunday-hint')).toBe(hint);
    expect(hint?.classList.contains('sr-only')).toBeFalse();
    expect(hint?.textContent).toContain('bulletins.create.dateHint');
  });

  it('drops expired cached dates when the server advances a stale cursor and keeps the creation mode', () => {
    const { component } = setup();
    component.openCreate();
    component.createMode.set('blank');
    service.defaults.and.returnValue(of(defaults({
      serviceDate: '2026-10-18',
      sundays: [
        { serviceDate: '2026-10-18', editionPublicId: null, status: null },
        { serviceDate: '2026-10-25', editionPublicId: null, status: null },
      ],
    })));
    component.loadDates('2026-10-11');
    expect(component.dateOptions().some(s => s.serviceDate === '2026-10-11')).toBeFalse();
    expect(component.selectedDate()).toBe('2026-10-18');
    expect(component.createMode()).toBe('blank');
  });

  it('keeps the Figma ISO date and source VOL in the copy hint', () => {
    const { component } = setup();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', { bulletins: { volume: 'VOL {{volume}}', create: { copyHint: '{{volume}}{{date}} 주보' } } });
    translate.use('ko');
    expect(component.copyHint()).toBe('VOL 12 · 2099-10-11 주보');
  });

  it('keeps the selected date and mode after a non-conflict create error', () => {
    const { component } = setup();
    component.openCreate();
    component.selectedDate.set('2026-10-25');
    component.createMode.set('blank');
    service.create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component.create();
    expect(component.selectedDate()).toBe('2026-10-25');
    expect(component.createMode()).toBe('blank');
    expect(component.createVisible()).toBeTrue();
    expect(component.creating()).toBeFalse();
  });

  it('retries a failed later batch with the same cursor and preserves date and mode', () => {
    const { component } = setup();
    component.openCreate();
    component.selectedDate.set('2026-10-25');
    component.createMode.set('blank');
    service.defaults.and.returnValue(throwError(() => new Error('network')));
    component.loadMoreDates();
    expect(component.datesFailed()).toBeTrue();
    expect(component.selectedDate()).toBe('2026-10-25');
    service.defaults.and.returnValue(of(defaults({
      sundays: [{ serviceDate: '2027-01-03', editionPublicId: null, status: null }], nextFrom: '2027-03-28',
    })));
    component.retryDates();
    expect(service.defaults).toHaveBeenCalledWith('2027-01-03');
    expect(component.selectedDate()).toBe('2026-10-25');
    expect(component.createMode()).toBe('blank');
  });

  it('prevents a double submission and closing the dialog while creation is pending', () => {
    const { component } = setup();
    const pending = new Subject<BulletinEdition>();
    service.create.and.returnValue(pending);
    component.openCreate();
    component.create();
    component.create();
    component.closeCreate();
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(component.createVisible()).toBeTrue();
    pending.next({ publicId: 'new' } as BulletinEdition);
    expect(component.createVisible()).toBeFalse();
  });

  it('does not request dates or create an edition without write access', () => {
    const { component } = setup({ canWrite: false });
    component.openCreate();
    component.create();
    expect(service.defaults).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
    expect(component.createVisible()).toBeFalse();
  });

  it('opens 설정 on its own route from tab 1 (#194)', () => {
    const { component, router, el } = setup();
    expect(el.querySelector('[data-testid="tab-settings"]')?.hasAttribute('disabled')).toBeFalse();
    component.onTab(0);
    expect(router.navigate).not.toHaveBeenCalled();
    component.onTab(1);
    expect(router.navigate).toHaveBeenCalledWith(['/bulletins', 'settings']);
  });
});
