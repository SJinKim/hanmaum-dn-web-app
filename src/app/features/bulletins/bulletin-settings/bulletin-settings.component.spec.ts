import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { Observable, of, throwError } from 'rxjs';

import { RoleService } from '../../../core/services/role.service';
import { BulletinSectionTitle, BulletinService } from '../bulletins.model';
import { BulletinsService } from '../bulletins.service';
import { BulletinSettingsComponent } from './bulletin-settings.component';

const SERVICES: BulletinService[] = [
  { publicId: 's1', name: '1부 예배', startTime: '09:00:00', sortOrder: 1, active: true, isBulletinDefault: false },
  { publicId: 's3', name: '3부 예배', startTime: '14:00:00', sortOrder: 3, active: false, isBulletinDefault: true },
];

const TITLES: BulletinSectionTitle[] = [
  { key: 'FIXED_BLESSING_PRAYER', title: '봉헌 및 축복기도', defaultTitle: '봉헌 및 축복기도' },
  { key: 'SECTION_WORSHIP', title: '찬양과 경배', defaultTitle: '경배와 찬양' },
  { key: 'SECTION_OFFERING', title: '봉헌', defaultTitle: '봉헌' },
  { key: 'SECTION_SENDING', title: '축복과 파송', defaultTitle: '축복과 파송' },
];

describe('BulletinSettingsComponent — 주보 설정 (#194)', () => {
  let service: jasmine.SpyObj<BulletinsService>;

  function setup(options: { canWrite?: boolean; fail?: boolean; deleteResult?: Observable<BulletinService | null> } = {}) {
    service = jasmine.createSpyObj<BulletinsService>('BulletinsService', [
      'services', 'sectionTitles', 'createService', 'updateService', 'deleteService', 'updateSectionTitle',
    ]);
    service.services.and.returnValue(options.fail ? throwError(() => new Error('boom')) : of(SERVICES));
    service.sectionTitles.and.returnValue(of(TITLES));
    service.deleteService.and.returnValue(options.deleteResult ?? of(null));

    TestBed.configureTestingModule({
      imports: [BulletinSettingsComponent],
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
    const fixture = TestBed.createComponent(BulletinSettingsComponent);
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

  it('lists the services with HH:mm, the default suffix and an inactive badge', () => {
    const { component } = setup();
    const [first, default3] = component.serviceRecords();
    expect(first.cells?.['startTime']).toBe('09:00');
    expect(default3.title).toBe('3부 예배 bulletins.settings.defaultSuffix');
    expect(first.title).toBe('1부 예배');
    expect(default3.badge?.variant).toBe('inactive');
    expect(component.nextSortOrder()).toBe(4);
  });

  it('orders the section titles and marks a changed one', () => {
    const { component } = setup();
    const records = component.titleRecords();
    expect(records.map(r => r.id)).toEqual(['SECTION_WORSHIP', 'SECTION_OFFERING', 'SECTION_SENDING', 'FIXED_BLESSING_PRAYER']);
    expect(records[0].badge?.variant).toBe('pending');
    expect(records[1].badge?.variant).toBe('active');
  });

  it('shows an error state when loading fails', () => {
    const { component, el } = setup({ fail: true });
    expect(component.failed()).toBeTrue();
    expect(el.querySelector('app-empty-state')).not.toBeNull();
  });

  it('hides 예배 추가 without write access and does not open the dialogs', () => {
    const { component, el } = setup({ canWrite: false });
    expect(el.querySelector('[data-testid="service-add"]')).toBeNull();
    component.openEditService('s1');
    component.openEditTitle('SECTION_WORSHIP');
    expect(component.serviceVisible()).toBeFalse();
    expect(component.titleVisible()).toBeFalse();
  });

  it('goes back to the list from tab 0', () => {
    const { component, router } = setup();
    component.onTab(0);
    expect(router.navigate).toHaveBeenCalledWith(['/bulletins']);
  });

  it('reports a delete that deactivated the service instead', () => {
    const { component, messages } = setup({ deleteResult: of({ ...SERVICES[0], active: false }) });
    component.confirmDeleteService('s1');
    expect(service.deleteService).toHaveBeenCalledWith('s1');
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'bulletins.settings.toast.deactivated' }));
    expect(service.services).toHaveBeenCalledTimes(2);
  });

  it('explains a 409 when deleting the default service', () => {
    const conflict = new HttpErrorResponse({ status: 409 });
    const { component, messages } = setup({ deleteResult: throwError(() => conflict) });
    component.confirmDeleteService('s3');
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'bulletins.settings.toast.defaultConflict' }));
  });

  it('saves a section title and stores null when it equals the default', () => {
    const { component } = setup();
    service.updateSectionTitle.and.returnValue(of({ ...TITLES[1], title: TITLES[1].defaultTitle }));
    component.openEditTitle('SECTION_WORSHIP');
    expect(component.titleDraft()).toBe('찬양과 경배');

    component.resetTitle();
    component.saveTitle();

    expect(service.updateSectionTitle).toHaveBeenCalledWith('SECTION_WORSHIP', { title: null });
    expect(component.titleVisible()).toBeFalse();
    expect(component.titleRecords()[0].badge?.variant).toBe('active');
  });

  it('saves a trimmed custom section title', () => {
    const { component } = setup();
    service.updateSectionTitle.and.returnValue(of({ ...TITLES[2], title: '헌금' }));
    component.openEditTitle('SECTION_OFFERING');
    component.titleDraft.set('  헌금 ');
    component.saveTitle();
    expect(service.updateSectionTitle).toHaveBeenCalledWith('SECTION_OFFERING', { title: '헌금' });
  });
});
