import { Signal, WritableSignal } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { HasUnsavedChanges, unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export interface GuideFormPage extends HasUnsavedChanges {
  state: { saving: Signal<boolean> };
  routeConfirming: WritableSignal<boolean>;
  navigationBlocked: WritableSignal<boolean>;
}

/** A pending write must finish; a dirty edit prompts exactly once, including Escape. */
export const guideFormGuard: CanDeactivateFn<GuideFormPage> = (...args) => {
  const component = args[0];
  if (component.state.saving()) { component.navigationBlocked.set(true); return false; }
  component.routeConfirming.set(true);
  const result = unsavedChangesGuard(...args);
  if (result instanceof Promise) return result.finally(() => component.routeConfirming.set(false));
  component.routeConfirming.set(false);
  return result;
};
