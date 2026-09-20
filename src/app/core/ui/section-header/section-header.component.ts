import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/**
 * Figma: Containers / SectionHeader (132:160).
 *
 * Title with an optional trailing Ghost/Small action. Sits above a Card or a
 * table inside a page, one level below PageHeader.
 */
@Component({
  selector: 'app-section-header',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <div class="flex w-full items-center justify-between gap-[var(--space-16)]">
      <h2 class="type-h3 text-ink-strong">{{ heading() }}</h2>
      <div class="flex shrink-0 items-center gap-[var(--space-8)]">
        @if (actionLabel()) {
          <p-button
            size="small"
            [text]="true"
            severity="secondary"
            [label]="actionLabel()"
            [icon]="actionIcon()"
            (onClick)="action.emit()" />
        }
        <ng-content select="[appActions]" />
      </div>
    </div>
  `,
})
export class SectionHeaderComponent {
  readonly heading = input.required<string>();
  /** Renders the Figma Ghost/Small trailing button when set. */
  readonly actionLabel = input<string>();
  readonly actionIcon = input<string>();

  readonly action = output<void>();
}
