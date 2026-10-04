import { booleanAttribute, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/**
 * Figma: Containers / PageHeader (133:212).
 *
 * Optional back button + breadcrumb utility row, eyebrow/title/subtitle block,
 * optional right-aligned actions projected through `[appActions]`.
 * Breadcrumb separators render in text/disabled against muted path segments.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <header class="flex w-full flex-col items-start gap-[var(--space-8)] pb-[var(--space-24)]">
      @if (hasBack() || breadcrumb().length) {
        <div class="flex items-center gap-[var(--space-8)]">
          @if (hasBack()) {
            <p-button
              [text]="true"
              severity="secondary"
              icon="pi pi-arrow-left"
              [ariaLabel]="backLabel()"
              (onClick)="back.emit()" />
          }
          @if (breadcrumb().length) {
            <p class="type-caption text-ink-muted">
              @for (segment of breadcrumb(); track $index) {
                @if (!$first) {
                  <span class="text-ink-disabled px-[var(--space-4)]">&rsaquo;</span>
                }
                <span>{{ segment }}</span>
              }
            </p>
          }
        </div>
      }

      <div class="flex w-full items-start justify-between gap-[var(--space-16)]">
        <div class="flex flex-col items-start gap-[var(--space-4)]">
          @if (eyebrow()) {
            <p class="type-overline text-ink-muted">{{ eyebrow() }}</p>
          }
          <h1 class="type-h1 text-ink-strong">{{ heading() }}</h1>
          @if (subtitle()) {
            <p class="type-body text-ink-muted">{{ subtitle() }}</p>
          }
        </div>
        <div class="flex shrink-0 items-center gap-[var(--space-8)]">
          <ng-content select="[appActions]" />
        </div>
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly heading = input.required<string>();
  readonly eyebrow = input<string>();
  readonly subtitle = input<string>();
  readonly breadcrumb = input<readonly string[]>([]);
  readonly hasBack = input(false, { transform: booleanAttribute });
  /** Accessible name for the back button — it carries no visible label. */
  readonly backLabel = input('뒤로');

  readonly back = output<void>();
}
