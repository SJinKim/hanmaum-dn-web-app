import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService, MessageService } from 'primeng/api';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { NewcomerVisitsComponent, percent, periodStart } from './newcomer-visits.component';
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

function page(content: NewcomerVisit[], totalElements = content.length) {
  return { content, totalElements, totalPages: Math.ceil(totalElements / 20), number: 0, size: 20 };
}

function stats(overrides: Partial<NewcomerVisitStats> = {}): NewcomerVisitStats {
  return {
    from: '2026-10-04', to: '2026-10-04',
    visits: 0, firstVisits: 0, revisits: 0, registered: 0, graduated: 0,
    bySource: [], byDay: [],
    ...overrides,
  };
}

describe('NewcomerVisitsComponent — 빠른 기록 (#40, #163)', () => {
  let service: jasmine.SpyObj<NewcomerVisitService>;

  function setup(options: { canWrite?: boolean; visits?: NewcomerVisit[]; total?: number; fail?: boolean } = {}) {
    service = jasmine.createSpyObj<NewcomerVisitService>('NewcomerVisitService', [
      'getVisits', 'getStats', 'createVisit', 'updateVisit', 'deleteVisit',
    ]);
    service.getVisits.and.returnValue(
      options.fail ? throwError(() => new Error('boom')) : of(page(options.visits ?? [visit()], options.total)),
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
    const confirmations = fixture.debugElement.injector.get(ConfirmationService);
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, component: fixture.componentInstance, router, messages, confirmations, el };
  }

  it('loads the first page of the last 30 days and today, month and year stats', () => {
    const { component } = setup();

    const { from, to, page: p, size } = service.getVisits.calls.mostRecent().args[0];
    const days = (Date.parse(to) - Date.parse(from!)) / 86_400_000;
    expect(days).toBe(29);
    expect(p).toBe(0);
    expect(size).toBe(20);
    expect(service.getStats).toHaveBeenCalledTimes(3);
    expect(service.getStats.calls.argsFor(0)[0]).toEqual({ from: to, to });
    expect(service.getStats.calls.argsFor(1)[0].from).toMatch(/-01$/);
    expect(service.getStats.calls.argsFor(2)[0].from).toMatch(/-01-01$/);
    expect(component.visits().length).toBe(1);
  });

  it('shows 경로 and 기타사항 in the table', () => {
    const { component } = setup({ visits: [visit({ source: 'ADVERTISEMENT', note: '소개자 김' })] });

    const cells = component.tableRows()[0].cells!;
    expect(cells['source']).toBe('newcomers.visits.source.ADVERTISEMENT');
    expect(cells['note']).toBe('소개자 김');
  });

  it('keeps the server order', () => {
    const { component } = setup({
      visits: [visit({ publicId: 'old', visitDate: '2026-09-20' }), visit({ publicId: 'new', visitDate: '2026-10-04' })],
    });

    expect(component.visits().map(v => v.publicId)).toEqual(['old', 'new']);
  });

  it('offers row actions only to editors', () => {
    expect(setup().component.columns().some(c => c.type === 'actions')).toBeTrue();
    TestBed.resetTestingModule();
    expect(setup({ canWrite: false }).component.columns().some(c => c.type === 'actions')).toBeFalse();
  });

  it('sends no from for 전체 and starts again on page 1', () => {
    const { component } = setup({ total: 45 });
    component.nextPage();
    expect(service.getVisits.calls.mostRecent().args[0].page).toBe(1);

    component.onPeriodChange('all');

    const query = service.getVisits.calls.mostRecent().args[0];
    expect(query.from).toBeUndefined();
    expect(query.page).toBe(0);
  });

  it('pages within the total', () => {
    const { component } = setup({ total: 45 });

    expect(component.hasPages()).toBeTrue();
    expect(component.lastPage()).toBe(2);
    component.prevPage();
    expect(component.page()).toBe(0);
    component.nextPage();
    component.nextPage();
    component.nextPage();
    expect(component.page()).toBe(2);
    expect(component.rangeParams()).toEqual({ from: 41, to: 45, total: 45 });
  });

  it('computes the start of each period', () => {
    const today = new Date(2026, 9, 4);
    expect(periodStart('30d', today)).toEqual(new Date(2026, 8, 5));
    expect(periodStart('3m', today)).toEqual(new Date(2026, 6, 5));
    expect(periodStart('year', today)).toEqual(new Date(2026, 0, 1));
    expect(periodStart('all', today)).toBeNull();
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

  it('loads a record into the form for 수정', () => {
    const { component, el, fixture } = setup({ visits: [visit({ source: 'FRIEND_FAMILY', note: '메모' })] });

    component.startEdit('v-1');
    fixture.detectChanges();

    expect(component.editing()?.publicId).toBe('v-1');
    expect(component.form.controls.lastName.value).toBe('홍');
    expect(component.form.controls.source.value).toBe('FRIEND_FAMILY');
    expect(component.gender()).toBe('M');
    expect(el.querySelector('[data-testid="visit-delete"]')).not.toBeNull();
  });

  it('updates, clears an emptied note with "" and returns to a new record', () => {
    const { component, messages } = setup({ visits: [visit({ note: '메모' })] });
    service.updateVisit.and.returnValue(of(visit()));
    component.startEdit('v-1');
    component.form.patchValue({ note: '' });

    component.save();

    expect(service.updateVisit).toHaveBeenCalledWith('v-1', jasmine.objectContaining({ note: '' }));
    expect(service.createVisit).not.toHaveBeenCalled();
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
    expect(component.editing()).toBeNull();
  });

  it('deletes after the confirmation', () => {
    const { component, confirmations, messages } = setup();
    service.deleteVisit.and.returnValue(of(undefined));
    spyOn(confirmations, 'confirm').and.callFake(c => {
      c.accept!();
      return confirmations;
    });

    component.confirmDelete('v-1');

    expect(service.deleteVisit).toHaveBeenCalledWith('v-1');
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
  });

  it('does not delete for readers', () => {
    const { component, confirmations } = setup({ canWrite: false });
    spyOn(confirmations, 'confirm');

    component.confirmDelete('v-1');

    expect(confirmations.confirm).not.toHaveBeenCalled();
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
