import { Component, input, output } from '@angular/core';
import { AvatarComponent } from '../avatar/avatar.component';
import { BadgeComponent } from '../badge/badge.component';
import { DataRecord } from '../data-record.model';

/**
 * Figma: Data / ListCard (118:365).
 *
 * "The Phone replacement for a Table/Row. Min height 72 so the whole card clears
 * the 44px touch target." It reads the same `DataRecord` as the table, so a
 * screen swaps the presentation without reshaping its data.
 *
 * The card is a `button` because the whole surface is the tap target; Pressed is
 * `active:`, not a separate input. The avatar is decorative here — the name is
 * already the visible title, so announcing it twice adds nothing.
 *
 * `progress` is deliberately not rendered: there is no room at 360px, and the
 * value is available on the record for the table presentation.
 */
@Component({
  selector: 'app-list-card',
  standalone: true,
  imports: [AvatarComponent, BadgeComponent],
  template: `
    <button
      class="border-line-subtle bg-surface active:bg-surface-subtle flex min-h-[72px] w-full items-center gap-[var(--space-12)] rounded-[var(--radius-lg)] border p-[var(--space-16)] text-left focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:2px]"
      type="button"
      (click)="selected.emit(record())">
      <app-avatar [name]="record().title" [initials]="record().initials" [size]="40" decorative />
      <span class="flex min-w-px flex-1 flex-col gap-[var(--space-2)] overflow-clip">
        <span class="type-body text-ink-strong truncate">{{ record().title }}</span>
        @if (record().subtitle) {
          <span class="type-caption text-ink-muted truncate">{{ record().subtitle }}</span>
        }
      </span>
      <span class="flex shrink-0 flex-col items-end gap-[var(--space-4)]">
        @if (record().badge; as badge) {
          <app-badge [variant]="badge.variant" [label]="badge.label" />
        }
        @if (record().meta) {
          <span class="type-caption text-ink-muted">{{ record().meta }}</span>
        }
      </span>
    </button>
  `,
})
export class ListCardComponent {
  readonly record = input.required<DataRecord>();

  readonly selected = output<DataRecord>();
}
