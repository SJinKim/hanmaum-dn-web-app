import { Component, input } from '@angular/core';

/**
 * Figma: Data / IconTile (186:1766) — "36×36 tile shared by StatCard and the
 * Home attention cards." Decorative by definition: the label next to it carries
 * the meaning, so the glyph stays hidden from assistive technology.
 */
@Component({
  selector: 'app-icon-tile',
  standalone: true,
  template: `
    <span
      class="bg-surface-subtle text-ink-muted inline-flex size-[36px] shrink-0 items-center justify-center overflow-clip rounded-[var(--radius-md)]">
      <i class="text-[16px]" [class]="icon()" aria-hidden="true"></i>
    </span>
  `,
})
export class IconTileComponent {
  /** PrimeIcons class, e.g. `pi pi-users`. */
  readonly icon = input('pi pi-users');
}
