import { Component, model, input } from '@angular/core';
import { AccordionModule } from 'primeng/accordion';

/** The one panel value — each section is its own single-panel accordion. */
const PANEL = 'section';

/**
 * Figma: Containers / AccordionSection (Home · grouped, #222).
 *
 * A collapsible group of page blocks. Built on PrimeNG `p-accordion`, whose
 * header renders as `role="button"` with `aria-expanded` and keyboard toggling;
 * the theme preset strips its chrome so the section sits on the page background
 * and the blocks inside keep their own cards. `expanded` is two-way so the
 * caller decides where the state lives.
 */
@Component({
  selector: 'app-accordion-section',
  standalone: true,
  imports: [AccordionModule],
  template: `
    <p-accordion [value]="expanded() ? panel : null" (valueChange)="expanded.set($event === panel)">
      <p-accordion-panel [value]="panel">
        <p-accordion-header>
          <span class="flex min-w-px flex-1 items-center gap-[var(--space-8)]">
            <i
              class="text-ink-muted pi shrink-0 text-[16px]"
              [class.pi-chevron-down]="expanded()"
              [class.pi-chevron-right]="!expanded()"
              aria-hidden="true"></i>
            <span class="type-h3 text-ink-strong truncate">{{ heading() }}</span>
            @if (count() !== undefined) {
              <span class="type-caption text-ink-muted tabular-nums">{{ count() }}</span>
            }
          </span>
          <!-- Empty on purpose: the chevron leads, as on GroupCard. -->
          <ng-template #toggleicon></ng-template>
        </p-accordion-header>
        <p-accordion-content>
          <div class="flex flex-col gap-gutter pt-[var(--space-12)]">
            <ng-content />
          </div>
        </p-accordion-content>
      </p-accordion-panel>
    </p-accordion>
  `,
})
export class AccordionSectionComponent {
  protected readonly panel = PANEL;

  readonly heading = input.required<string>();
  /** Optional trailing number, e.g. how many blocks the group holds. */
  readonly count = input<number>();
  readonly expanded = model(true);
}
