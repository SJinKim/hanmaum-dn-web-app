import { Component, computed, input } from '@angular/core';

/** Figma: DefinitionList/Row Layout axis (104:60) — Stacked / Inline. */
export type DefinitionRowLayout = 'stacked' | 'inline';

/**
 * Figma: Data / DefinitionList / Row (104:60).
 *
 * "Term = overline (10px, muted). Stacked for narrow columns, Inline for a fixed
 * 120px term column." A `dl` wrapper belongs to the caller — a single row cannot
 * own the list semantics, so this renders the `dt`/`dd` pair only.
 *
 * A value that is more than text (a badge, a chip row) is projected instead of
 * passed as `value`.
 */
@Component({
  selector: 'app-definition-row',
  standalone: true,
  // One markup for both layouts: `ng-content` may appear only once, so the layout
  // switches classes rather than branches.
  template: `
    <div
      class="flex w-full"
      [class]="inline() ? 'items-baseline gap-[var(--space-12)]' : 'flex-col gap-[var(--space-2)]'">
      <dt class="type-overline text-ink-muted" [class]="inline() ? 'w-[120px] shrink-0' : ''">{{ term() }}</dt>
      <dd class="type-body text-ink-strong m-0" [class]="inline() ? 'min-w-0 flex-1' : ''">
        {{ value() }}<ng-content />
      </dd>
    </div>
  `,
  // The host sits between the caller's `dl` and the `dt`/`dd` pair; `contents`
  // takes it out of the box tree so the list semantics survive.
  styles: [':host { display: contents; }'],
})
export class DefinitionRowComponent {
  readonly term = input.required<string>();
  readonly value = input<string>('');
  readonly layout = input<DefinitionRowLayout>('stacked');

  protected readonly inline = computed(() => this.layout() === 'inline');
}
