import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { NewcomerVisitsComponent, percent } from './newcomer-visits.component';
import { NewcomerVisitService } from '../newcomer-visit.service';
import { RoleService } from '../../../core/services/role.service';
import { NewcomerVisit, NewcomerVisitStats } from '../../../core/models/newcomer-visit.model';

function visit(overrides: Partial<NewcomerVisit> = {}): NewcomerVisit {
  return {
    publicId: 'v-1',
    visitDate: '2026-10-04',
    lastName: '홍',
    firstName: '길동',
    fullName: '홍길동',
    gender: 'M',
    birthYear: 1999,
    visitType: 'FIRST',
    source: null,
    note: null,
    newcomerPublicId: null,
    newcomerLifecycle: null,
    createdAt: '2026-10-04T10:00:00Z',
    ...overrides,
  };
}

function stats(overrides: Partial<NewcomerVisitStats> = {}): NewcomerVisitStats {
  return {
    from: '2026-10-04', to: '2026-10-04',
    visits: 0, firstVisits: 0, revisits: 0, registered: 0, graduated: 0,
    bySource: [], byDay: [],
    ...overrides,
  };
}

describe('NewcomerVisitsComponent — 방문 기록 (#40)', () => {
  let service: jasmine.SpyObj<NewcomerVisitService>;

  function setup(options: { canWrite?: boolean; visits?: NewcomerVisit[]; fail?: boolean } = {}) {
    service = jasmine.createSpyObj<NewcomerVisitService>('NewcomerVisitService', ['getVisits', 'getStats', 'createVisit']);
    service.getVisits.and.returnValue(
      options.fail ? throwError(() => new Error('boom')) : of(options.visits ?? [visit()]),
    );
    service.getStats.and.returnValue(of(stats({ visits: 21, firstVisits: 3, revisits: 1, registered: 9, graduated: 5 })));

    TestBed.configureTestingModule({
      imports: [NewcomerVisitsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: NewcomerVisitService, useValue: service },
        { provide: RoleService, useValue: { canWrite: () => options.canWrite ?? true, hasAnyRole: () => true, isAdmin: () => true } },
      ],
    });
    const fixture = TestBed.createComponent(NewcomerVisitsComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(messages, 'add');
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, component: fixture.componentInstance, router, messages, el };
  }

  it('loads 30 days of history and today, month and year stats', () => {
    const { component } = setup();

    const { from, to } = service.getVisits.calls.mostRecent().args[0];
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    expect(days).toBe(29);
    expect(service.getStats).toHaveBeenCalledTimes(3);
    expect(service.getStats.calls.argsFor(0)[0]).toEqual({ from: to, to });
    expect(service.getStats.calls.argsFor(1)[0].from).toMatch(/-01$/);
    expect(service.getStats.calls.argsFor(2)[0].from).toMatch(/-01-01$/);
    expect(component.visits().length).toBe(1);
  });

  it('shows the 방문 badge until a profile is linked', () => {
    const { component } = setup({ visits: [visit(), visit({ publicId: 'v-2', newcomerPublicId: 'n-1' })] });

    const badges = component.tableRows().map(r => (r.cells!['status'] as { variant: string }).variant);
    expect(badges).toEqual(['pending', 'active']);
  });

  it('sorts history by visit date, newest first', () => {
    const { component } = setup({
      visits: [visit({ publicId: 'old', visitDate: '2026-09-20' }), visit({ publicId: 'new', visitDate: '2026-10-04' })],
    });

    expect(component.visits().map(v => v.publicId)).toEqual(['new', 'old']);
  });

  it('hides the form from readers', () => {
    const { el } = setup({ canWrite: false });

    expect(el.querySelector('[data-testid="visit-form"]')).toBeNull();
  });

  it('shows the error state when loading fails', () => {
    const { component } = setup({ fail: true });

    expect(component.failed()).toBeTrue();
  });

  it('does not save without 성 and 이름', () => {
    const { component } = setup();

    component.save();

    expect(service.createVisit).not.toHaveBeenCalled();
    expect(component.form.controls.lastName.touched).toBeTrue();
  });

  it('rejects a birth year outside 1900–2100', () => {
    const { component } = setup();
    component.form.patchValue({ lastName: '홍', firstName: '길동', birthYear: 1899 });

    component.save();

    expect(service.createVisit).not.toHaveBeenCalled();
  });

  it('saves, keeps 방문일, clears the rest and reloads', () => {
    const { component, messages } = setup();
    service.createVisit.and.returnValue(of(visit()));
    const date = new Date(2026, 9, 4);
    component.form.patchValue({
      visitDate: date, lastName: ' 홍 ', firstName: '길동', birthYear: 1999,
      visitType: 'REVISIT', source: 'ADVERTISEMENT', note: '  ',
    });
    component.onGenderChange('M');
    service.getVisits.calls.reset();

    component.save();

    expect(service.createVisit).toHaveBeenCalledWith({
      visitDate: '2026-10-04',
      lastName: '홍',
      firstName: '길동',
      gender: 'M',
      birthYear: 1999,
      visitType: 'REVISIT',
      source: 'ADVERTISEMENT',
      note: undefined,
    });
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
    expect(component.form.controls.visitDate.value).toBe(date);
    expect(component.form.controls.lastName.value).toBe('');
    expect(component.form.controls.visitType.value).toBe('FIRST');
    expect(component.gender()).toBe('');
    expect(service.getVisits).toHaveBeenCalled();
  });

  it('keeps the input when saving fails', () => {
    const { component, messages } = setup();
    service.createVisit.and.returnValue(throwError(() => new Error('boom')));
    component.form.patchValue({ lastName: '홍', firstName: '길동' });

    component.save();

    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(component.form.controls.lastName.value).toBe('홍');
    expect(component.saving()).toBeFalse();
  });

  it('goes back to the 새가족 list', () => {
    const { component, router } = setup();

    component.goToList();

    expect(router.navigate).toHaveBeenCalledWith(['/newcomers']);
  });

  it('computes shares without dividing by zero', () => {
    expect(percent(9, 21)).toBe(43);
    expect(percent(5, 0)).toBe(0);
  });
});
