import { booleanAttribute, Component, input } from '@angular/core';

/**
 * Figma: Containers / Toolbar (135:150).
 *
 * The row above every list screen: a search field that takes the free space, the
 * primary action on the right, and — when `hasFilters` — a chip row below it.
 * Purely a layout shell; the caller projects the actual controls, so Members,
 * Ministry, Announcements, Events and Attendance share one geometry.
 */
@Component({
  selector: 'app-toolbar',
  standalone: true,
  template: `
    <div class="flex w-full flex-col items-start gap-[var(--space-12)] pb-[var(--space-20)]">
      <div class="flex w-full items-center gap-[var(--space-12)]">
        <div class="min-w-0 flex-1">
          <ng-content select="[appSearch]" />
        </div>
        <div class="flex shrink-0 items-center gap-[var(--space-8)]">
          <ng-content select="[appActions]" />
        </div>
      </div>

      @if (hasFilters()) {
        <div class="flex flex-wrap items-center gap-[var(--space-8)]">
          <ng-content select="[appFilters]" />
        </div>
      }
    </div>
  `,
})
export class ToolbarComponent {
  /** Figma variant property — renders the chip row. */
  readonly hasFilters = input(false, { transform: booleanAttribute });
}
