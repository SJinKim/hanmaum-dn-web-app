import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

/** A routed component that can hold edits the user has not saved yet. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Key of the `<p-confirmdialog>` that answers this guard. The guarded component
 * renders it: the guard runs outside the component, so it reaches the root
 * `ConfirmationService`, and hosting the dialog in the lazy component keeps
 * PrimeNG's dialog out of the initial bundle. The key keeps it apart from the
 * key-less dialogs other screens show.
 */
export const UNSAVED_CHANGES_DIALOG_KEY = 'unsaved-changes';

/** Asks before leaving a route whose component reports unsaved changes; 취소 stays. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = component => {
  if (!component?.hasUnsavedChanges()) return true;

  const confirmation = inject(ConfirmationService);
  const translate = inject(TranslateService);
  return new Promise<boolean>(resolve => {
    confirmation.confirm({
      key: UNSAVED_CHANGES_DIALOG_KEY,
      header: translate.instant('common.unsavedChanges.header') as string,
      message: translate.instant('common.unsavedChanges.message') as string,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: translate.instant('common.unsavedChanges.leave') as string,
      rejectLabel: translate.instant('common.unsavedChanges.stay') as string,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => resolve(true),
      // Also fires on ✕ and Escape, so every way out of the dialog but 나가기 stays.
      reject: () => resolve(false),
    });
  });
};
