import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { provideTranslateService } from '@ngx-translate/core';

import {
  HasUnsavedChanges,
  UNSAVED_CHANGES_DIALOG_KEY,
  unsavedChangesGuard,
} from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  let confirmSpy: jasmine.Spy<(c: Confirmation) => ConfirmationService>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConfirmationService, provideTranslateService({ fallbackLang: 'en' })],
    });
    confirmSpy = spyOn(TestBed.inject(ConfirmationService), 'confirm');
  });

  function run(dirty: boolean) {
    const component: HasUnsavedChanges = { hasUnsavedChanges: () => dirty };
    return TestBed.runInInjectionContext(() => unsavedChangesGuard(
      component,
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
      {} as RouterStateSnapshot,
    ));
  }

  it('lets the user leave without asking when nothing changed', () => {
    expect(run(false)).toBeTrue();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('asks through the shell dialog when there are unsaved changes', () => {
    void run(true);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.calls.mostRecent().args[0].key).toBe(UNSAVED_CHANGES_DIALOG_KEY);
  });

  it('leaves when the user accepts', async () => {
    confirmSpy.and.callFake(c => { c.accept!(); return TestBed.inject(ConfirmationService); });
    await expectAsync(run(true) as Promise<boolean>).toBeResolvedTo(true);
  });

  it('stays when the user cancels', async () => {
    confirmSpy.and.callFake(c => { c.reject!(); return TestBed.inject(ConfirmationService); });
    await expectAsync(run(true) as Promise<boolean>).toBeResolvedTo(false);
  });
});
