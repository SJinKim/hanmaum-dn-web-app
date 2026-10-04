import { Component, input } from '@angular/core';
import { BadgeComponent } from '../badge/badge.component';
import { IconTileComponent } from '../icon-tile/icon-tile.component';
import { DataRecordBadge } from '../data-record.model';

/**
 * Figma: Data / StatCard (109:64) — NoDelta / WithDelta / Empty.
 *
 * NoDelta is the default and the variant every screen should reach for. The
 * Empty variant is not a flag: pass `value = '—'` with an explanatory `subtext`,
 * because an empty stat is data, not a different card.
 *
 * ⚠ Figma annotation (105:47): "WithDelta must NOT be used until a real delta
 * calculation exists. home.component.ts currently hardcodes +12% / +3% as string
 * literals; NoDelta is the default and what Home should keep using." The
 * `delta*` inputs exist so the variant is not re-invented per screen — leave
 * them unset until a backend delta arrives.
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [BadgeComponent, IconTileComponent],
  template: `
    <div
      class="bg-surface border-line-subtle shadow-elevation-sm flex flex-col items-start gap-[var(--space-8)] rounded-[var(--radius-lg)] border p-card">
      <app-icon-tile [icon]="icon()" />
      <span class="type-overline text-ink-muted">{{ label() }}</span>
      <div class="flex items-center gap-[var(--space-8)] overflow-clip">
        <span class="type-display text-ink-strong">{{ value() }}</span>
        @if (delta()) {
          <span class="type-caption text-ink-muted">{{ delta() }}</span>
        }
        @if (deltaBadge(); as badge) {
          <app-badge [variant]="badge.variant" [label]="badge.label" />
        }
      </div>
      @if (subtext()) {
        <span class="type-caption text-ink-muted">{{ subtext() }}</span>
      }
    </div>
  `,
})
export class StatCardComponent {
  /** PrimeIcons class for the IconTile. */
  readonly icon = input('pi pi-users');
  readonly label = input.required<string>();
  /** Already formatted — `'—'` for the Empty variant. */
  readonly value = input.required<string>();
  readonly subtext = input<string>();
  /** ⚠ Leave unset until a real delta calculation exists. */
  readonly delta = input<string>();
  /** ⚠ Leave unset until a real delta calculation exists. */
  readonly deltaBadge = input<DataRecordBadge>();
}
