import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService, MessageService } from 'primeng/api';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { NewcomerQrLinksComponent, expiresAtFor, remaining } from './newcomer-qr-links.component';
import { NewcomerFormLinkService } from '../newcomer-form-link.service';
import { RoleService } from '../../../core/services/role.service';
import { NewcomerFormLink } from '../../../core/models/newcomer-form-link.model';

const HOUR = 3_600_000;

function link(overrides: Partial<NewcomerFormLink> = {}): NewcomerFormLink {
  return {
    publicId: 'l-1',
    expiresAt: new Date(Date.now() + 5 * HOUR).toISOString(),
    revokedAt: null,
    active: true,
    useCount: 3,
    ...overrides,
  };
}

describe('QR link helpers (#44)', () => {
  it('sends now + the chosen hours, keeping 24 h under the server cap', () => {
    const now = Date.parse('2026-10-04T08:00:00Z');
    expect(expiresAtFor(12, now)).toBe('2026-10-04T20:00:00.000Z');
    expect(Date.parse(expiresAtFor(24, now)) - now).toBeLessThan(24 * HOUR);
    expect(Date.parse(expiresAtFor(24, now)) - now).toBeGreaterThan(23 * HOUR);
  });

  it('counts the time left and never goes negative', () => {
    const now = Date.parse('2026-10-04T08:00:00Z');
    expect(remaining('2026-10-04T10:30:00Z', now)).toEqual({ hours: 2, minutes: 30 });
    expect(remaining('2026-10-04T07:00:00Z', now)).toEqual({ hours: 0, minutes: 0 });
  });
});

describe('NewcomerQrLinksComponent — QR 등록 링크 (#44)', () => {
  let service: jasmine.SpyObj<NewcomerFormLinkService>;

  function setup(options: { canWrite?: boolean; links?: NewcomerFormLink[]; fail?: boolean } = {}) {
    service = jasmine.createSpyObj<NewcomerFormLinkService>('NewcomerFormLinkService', [
      'getLinks', 'createLink', 'revokeLink',
    ]);
    service.getLinks.and.returnValue(
      options.fail ? throwError(() => new Error('boom')) : of(options.links ?? [link()]),
    );

    TestBed.configureTestingModule({
      imports: [NewcomerQrLinksComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: NewcomerFormLinkService, useValue: service },
        { provide: RoleService, useValue: { canWrite: () => options.canWrite ?? true, hasAnyRole: () => true, isAdmin: () => true } },
      ],
    });
    const fixture = TestBed.createComponent(NewcomerQrLinksComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(messages, 'add');
    const confirmations = fixture.debugElement.injector.get(ConfirmationService);
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, component: fixture.componentInstance, router, messages, confirmations, el };
  }

  it('lists links with status, time left and use count', () => {
    const { el } = setup({
      links: [
        link({ publicId: 'a' }),
        link({ publicId: 'b', active: false, expiresAt: new Date(Date.now() - HOUR).toISOString() }),
        link({ publicId: 'c', active: false, revokedAt: new Date().toISOString() }),
      ],
    });
    const rows = Array.from(el.querySelectorAll('[data-testid="link-row"]'));
    expect(rows.map(r => r.getAttribute('data-status'))).toEqual(['active', 'expired', 'revoked']);
    expect(rows[0].querySelector('[data-testid="link-remaining"]')).not.toBeNull();
    expect(rows[1].querySelector('[data-testid="link-remaining"]')).toBeNull();
    expect(rows[0].querySelector('[data-testid="link-uses"]')?.textContent).toContain('newcomers.qrLinks.list.uses');
  });

  it('offers 취소 only on active links', () => {
    const { el } = setup({ links: [link({ publicId: 'a' }), link({ publicId: 'b', active: false })] });
    expect(el.querySelectorAll('[data-testid="link-revoke"]').length).toBe(1);
  });

  it('shows an error state with retry', () => {
    const { el, component } = setup({ fail: true });
    expect(el.querySelector('app-empty-state')).not.toBeNull();
    service.getLinks.and.returnValue(of([link()]));
    component.load();
    expect(component.failed()).toBeFalse();
    expect(component.links().length).toBe(1);
  });

  it('creates a link for the chosen hours and shows its QR once', async () => {
    const { component } = setup({ links: [] });
    const before = Date.now();
    service.createLink.and.returnValue(of(link({ publicId: 'new', useCount: 0, token: 'tok-123' })));

    component.openCreate();
    expect(component.hours()).toBe('12');
    component.hours.set('4');
    component.create();

    const sent = Date.parse(service.createLink.calls.mostRecent().args[0].expiresAt!);
    expect(sent - before).toBeGreaterThanOrEqual(4 * HOUR - 1000);
    expect(sent - before).toBeLessThanOrEqual(4 * HOUR + 1000);
    expect(component.createdUrl()).toBe(`${location.origin}/register/tok-123`);
    expect(component.links()[0].token).toBeNull();

    // QRCode.toDataURL resolves asynchronously; the minute ticker keeps whenStable() from settling.
    for (let i = 0; i < 50 && !component.qrDataUrl(); i++) await new Promise(r => setTimeout(r, 10));
    expect(component.qrDataUrl()).toMatch(/^data:image\/png;base64,/);

    component.onCreateVisibleChange(false);
    expect(component.created()).toBeNull();
    expect(component.qrDataUrl()).toBeNull();
    expect(component.createdUrl()).toBeNull();
  });

  it('keeps the dialog open with an error when creating fails', () => {
    const { component } = setup();
    service.createLink.and.returnValue(throwError(() => new Error('boom')));
    component.openCreate();
    component.create();
    expect(component.createFailed()).toBeTrue();
    expect(component.createOpen()).toBeTrue();
  });

  it('revokes after confirmation and marks the row 취소', () => {
    const { component, confirmations, messages } = setup();
    const revokedAt = new Date().toISOString();
    service.revokeLink.and.returnValue(of(link({ active: false, revokedAt })));
    spyOn(confirmations, 'confirm').and.callFake(c => {
      c.accept?.();
      return confirmations;
    });

    component.confirmRevoke(component.links()[0]);

    expect(service.revokeLink).toHaveBeenCalledWith('l-1');
    expect(component.rows()[0].status).toBe('revoked');
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
  });

  it('reports a failed revoke', () => {
    const { component, confirmations, messages } = setup();
    service.revokeLink.and.returnValue(throwError(() => new Error('boom')));
    spyOn(confirmations, 'confirm').and.callFake(c => {
      c.accept?.();
      return confirmations;
    });
    component.confirmRevoke(component.links()[0]);
    expect(component.rows()[0].status).toBe('active');
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
  });

  it('lets a viewer see links but not create or revoke', () => {
    const { el } = setup({ canWrite: false });
    expect(el.querySelectorAll('[data-testid="link-row"]').length).toBe(1);
    expect(el.querySelector('[data-testid="create-link"]')).toBeNull();
    expect(el.querySelector('[data-testid="link-revoke"]')).toBeNull();
  });

  it('goes back to the newcomer list', () => {
    const { component, router } = setup();
    component.goToList();
    expect(router.navigate).toHaveBeenCalledWith(['/newcomers']);
  });
});
