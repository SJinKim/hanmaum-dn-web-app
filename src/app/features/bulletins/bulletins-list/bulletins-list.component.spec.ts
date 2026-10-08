import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { RoleService } from '../../../core/services/role.service';
import { BulletinEdition, BulletinEditionSummary } from '../bulletins.model';
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

describe('BulletinsListComponent — 주보 목록 (#36)', () => {
  let service: jasmine.SpyObj<BulletinsService>;

  function setup(options: { canWrite?: boolean; editions?: BulletinEditionSummary[]; fail?: boolean } = {}) {
    service = jasmine.createSpyObj<BulletinsService>('BulletinsService', ['list', 'create', 'delete']);
    service.list.and.returnValue(
      options.fail ? throwError(() => new Error('boom')) : of(page(options.editions ?? [summary()])),
    );

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
    return { fixture, component: fixture.componentInstance, router, el: fixture.nativeElement as HTMLElement };
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

    expect(service.create).toHaveBeenCalledWith({ copyFrom: 'b1' });
    expect(router.navigate).toHaveBeenCalledWith(['/bulletins', 'new']);
    expect(component.createVisible()).toBeFalse();
  });

  it('creates a blank draft when there is nothing to copy', () => {
    const { component } = setup({ editions: [] });
    service.create.and.returnValue(of({ publicId: 'new' } as BulletinEdition));
    component.openCreate();
    expect(component.createMode()).toBe('blank');
    component.create();
    expect(service.create).toHaveBeenCalledWith({});
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

  it('opens 설정 on its own route from tab 1 (#194)', () => {
    const { component, router, el } = setup();
    expect(el.querySelector('[data-testid="tab-settings"]')?.hasAttribute('disabled')).toBeFalse();
    component.onTab(0);
    expect(router.navigate).not.toHaveBeenCalled();
    component.onTab(1);
    expect(router.navigate).toHaveBeenCalledWith(['/bulletins', 'settings']);
  });
});
