import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { PublicRegisterComponent, newIdempotencyKey } from './public-register.component';
import { PublicFormService } from './public-form.service';

const META = { expiresAt: '2026-10-05T08:00:00Z', consentVersion: '2026-09' };
const RESPONSE = { newcomerPublicId: 'n-1', submittedAt: '2026-10-04T08:00:00Z' };

describe('newIdempotencyKey', () => {
  it('fits the 8–200 characters the contract allows and differs per call', () => {
    const a = newIdempotencyKey();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a.length).toBeLessThanOrEqual(200);
    expect(newIdempotencyKey()).not.toBe(a);
  });
});

describe('PublicRegisterComponent — 새가족 등록 (공개) (#42)', () => {
  let service: jasmine.SpyObj<PublicFormService>;

  function setup(options: { token?: string | null; loadStatus?: number } = {}) {
    service = jasmine.createSpyObj<PublicFormService>('PublicFormService', ['getForm', 'submit']);
    service.getForm.and.returnValue(
      options.loadStatus ? throwError(() => ({ status: options.loadStatus })) : of(META),
    );
    const token = options.token === undefined ? 'tok-123' : options.token;

    TestBed.configureTestingModule({
      imports: [PublicRegisterComponent],
      providers: [
        provideNoopAnimations(),
        provideTranslateService(),
        { provide: PublicFormService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(token ? { token } : {}) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(PublicRegisterComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  function fillValid(component: PublicRegisterComponent): void {
    component.form.patchValue({
      lastName: ' 홍 ',
      firstName: '길동',
      gender: 'M',
      birthDate: new Date(1990, 0, 15),
      phoneCountry: 'DE',
      phoneLocal: '151 2345678',
      churchExperience: 'FIRST_TIME',
      baptism: 'UNBAPTIZED',
      motives: { REFERRAL: true },
      consentAccepted: true,
    });
  }

  it('shows the form once the token resolves', () => {
    const { component } = setup();
    expect(service.getForm).toHaveBeenCalledWith('tok-123');
    expect(component.state()).toBe('form');
    expect(component.consentVersion()).toBe('2026-09');
  });

  it('treats a 404 as an expired or revoked link', () => {
    const { component } = setup({ loadStatus: 404 });
    expect(component.state()).toBe('unavailable');
  });

  it('offers a retry for any other load failure', () => {
    const { component } = setup({ loadStatus: 500 });
    expect(component.state()).toBe('error');
  });

  it('does not call the server without a token', () => {
    const { component } = setup({ token: null });
    expect(service.getForm).not.toHaveBeenCalled();
    expect(component.state()).toBe('unavailable');
  });

  it('does not submit an invalid form', () => {
    const { component } = setup();
    component.submit();
    expect(service.submit).not.toHaveBeenCalled();
    expect(component.form.get('lastName')!.touched).toBeTrue();
  });

  it('requires at least one visit motive and the consent', () => {
    const { component } = setup();
    fillValid(component);
    component.form.patchValue({ motives: { REFERRAL: false }, consentAccepted: false });
    expect(component.form.get('motives')!.hasError('noMotive')).toBeTrue();
    expect(component.form.get('consentAccepted')!.invalid).toBeTrue();
  });

  it('sends the trimmed request and ends on the done page', () => {
    const { component } = setup();
    service.submit.and.returnValue(of(RESPONSE));
    fillValid(component);
    component.submit();

    const [token, body, key] = service.submit.calls.mostRecent().args;
    expect(token).toBe('tok-123');
    expect(key.length).toBeGreaterThanOrEqual(8);
    expect(body).toEqual(jasmine.objectContaining({
      lastName: '홍',
      firstName: '길동',
      gender: 'M',
      birthDate: '1990-01-15',
      phoneNumber: '+491512345678',
      visitMotives: ['지인의 소개로'],
      consentAccepted: true,
      honeypot: '',
    }));
    expect(body.email).toBeUndefined();
    expect(component.state()).toBe('done');
    expect(component.form.get('lastName')!.value).toBeFalsy();
  });

  it('appends the free text to 기타', () => {
    const { component } = setup();
    service.submit.and.returnValue(of(RESPONSE));
    fillValid(component);
    component.form.patchValue({ motives: { OTHER: true }, otherMotive: ' 유튜브 ' });
    component.submit();

    expect(service.submit.calls.mostRecent().args[1].visitMotives).toEqual(['지인의 소개로', '기타: 유튜브']);
  });

  it('reuses the key on a retry and shows the rate limit', () => {
    const { component } = setup();
    service.submit.and.returnValue(throwError(() => ({ status: 429 })));
    fillValid(component);

    component.submit();
    component.submit();

    const keys = service.submit.calls.all().map(c => c.args[2]);
    expect(keys.length).toBe(2);
    expect(keys[1]).toBe(keys[0]);
    expect(component.submitError()).toBe('rateLimited');
    expect(component.state()).toBe('form');
  });

  it('uses a new key once the input changes', () => {
    const { component } = setup();
    service.submit.and.returnValue(throwError(() => ({ status: 400 })));
    fillValid(component);

    component.submit();
    expect(component.submitError()).toBe('invalid');
    component.form.patchValue({ firstName: '길순' });
    expect(component.submitError()).toBeNull();
    component.submit();

    const keys = service.submit.calls.all().map(c => c.args[2]);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('switches to unavailable when the link dies before submitting', () => {
    const { component } = setup();
    service.submit.and.returnValue(throwError(() => ({ status: 404 })));
    fillValid(component);
    component.submit();
    expect(component.state()).toBe('unavailable');
  });
});
