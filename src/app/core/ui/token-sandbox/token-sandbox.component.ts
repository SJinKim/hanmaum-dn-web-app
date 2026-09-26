import { Component, HostListener, signal } from '@angular/core';

interface TokenGroup {
  readonly title: string;
  readonly tokens: readonly string[];
}

/**
 * Living reference for the Figma token layer in src/styles.scss.
 *
 * It renders every Theme token in Light and Dark side by side, the eight text
 * styles, the three elevations and the Density values for the current viewport.
 * Route: /design-tokens. Not linked from the navigation — it is a reference for
 * whoever builds a screen, and the check that a token change did what it says.
 */
@Component({
  selector: 'app-token-sandbox',
  standalone: true,
  template: `
    <div>
      <header class="mb-gutter flex items-end justify-between gap-gutter">
        <div>
          <h1 class="type-h1 text-ink-strong">Design Tokens</h1>
          <p class="type-body text-ink-muted mt-1">
            Figma "DN-Web" · Primitives / Theme / Density · see design-specs/DESIGN.md
          </p>
        </div>
        <span class="type-caption text-ink-muted">
          {{ viewport() }}px — {{ densityMode() }}
        </span>
      </header>

      <!-- Theme tokens, both modes side by side -->
      <section class="mb-gutter">
        <h2 class="type-h2 text-ink-strong mb-3">Theme</h2>
        <div class="grid grid-cols-1 gap-gutter lg:grid-cols-2">
          @for (mode of modes; track mode) {
            <div [attr.data-theme]="mode"
                 class="rounded-[var(--radius-lg)] border border-line bg-surface-base p-card">
              <h3 class="type-overline text-ink-muted mb-3">{{ mode }}</h3>
              @for (group of colorGroups; track group.title) {
                <p class="type-caption text-ink-muted mt-4 mb-2">{{ group.title }}</p>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  @for (token of group.tokens; track token) {
                    <div class="rounded-[var(--radius-sm)] border border-line-subtle bg-surface p-2">
                      <div class="h-8 rounded-[var(--radius-sm)] border border-line-subtle"
                           [style.background]="cssVar(token)"></div>
                      <code class="type-caption text-ink-muted mt-1 block break-all">{{ token }}</code>
                    </div>
                  }
                </div>
              }

              <p class="type-caption text-ink-muted mt-4 mb-2">Badge</p>
              <div class="flex flex-wrap gap-2">
                @for (badge of badges; track badge) {
                  <span [class]="'status-badge badge-' + badge">{{ badge }}</span>
                }
              </div>

              <p class="type-caption text-ink-muted mt-4 mb-2">Category</p>
              <div class="flex flex-wrap gap-2">
                @for (category of categories; track category) {
                  <span class="type-caption inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-2 py-1"
                        [style.background]="cssVar('--color-category-' + category + '-bg')"
                        [style.color]="cssVar('--color-category-' + category + '-fg')">
                    <span class="inline-block h-2 w-2 rounded-[var(--radius-full)]"
                          [style.background]="cssVar('--color-category-' + category + '-dot')"></span>
                    {{ category }}
                  </span>
                }
              </div>

              <p class="type-caption text-ink-muted mt-4 mb-2">Elevation</p>
              <div class="flex flex-wrap gap-gutter">
                @for (elevation of elevations; track elevation) {
                  <div class="type-caption text-ink-muted rounded-[var(--radius-md)] bg-surface px-4 py-3"
                       [style.box-shadow]="cssVar('--shadow-' + elevation)">
                    shadow-{{ elevation }}
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Type scale -->
      <section class="mb-gutter rounded-[var(--radius-lg)] border border-line bg-surface p-card">
        <h2 class="type-h2 text-ink-strong mb-3">Type</h2>
        @for (style of textStyles; track style) {
          <div class="flex items-baseline gap-4 border-b border-line-subtle py-2 last:border-0">
            <code class="type-caption text-ink-muted w-28 shrink-0">.type-{{ style }}</code>
            <span [class]="'type-' + style" class="text-ink">다람쥐 헌 쳇바퀴 Aa 0123</span>
            <span class="type-caption text-ink-muted ml-auto shrink-0">{{ fontSize('type-' + style) }}</span>
          </div>
        }
      </section>

      <!-- Density -->
      <section class="rounded-[var(--radius-lg)] border border-line bg-surface p-card">
        <h2 class="type-h2 text-ink-strong mb-3">Density — {{ densityMode() }}</h2>
        <div class="grid grid-cols-2 gap-x-gutter gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
          @for (token of densityTokens; track token) {
            <div class="flex items-baseline justify-between gap-2 border-b border-line-subtle py-1">
              <code class="type-caption text-ink-muted break-all">{{ token }}</code>
              <span class="type-body-sm text-ink shrink-0">{{ resolved(token) }}</span>
            </div>
          }
        </div>
      </section>
    </div>
  `,
})
export class TokenSandboxComponent {
  /** Bumped on resize so the resolved Density values re-render. */
  private readonly tick = signal(0);

  readonly modes = ['light', 'dark'] as const;

  readonly colorGroups: readonly TokenGroup[] = [
    { title: 'Background', tokens: ['--color-bg-base', '--color-bg-surface', '--color-bg-subtle'] },
    { title: 'Border', tokens: ['--color-border-subtle', '--color-border-default', '--color-border-strong'] },
    {
      title: 'Text',
      tokens: [
        '--color-text-strong', '--color-text-default', '--color-text-muted',
        '--color-text-disabled', '--color-text-inverse',
      ],
    },
    {
      title: 'Action',
      tokens: [
        '--color-action-primary', '--color-action-primary-hover', '--color-action-primary-active',
        '--color-action-on-primary', '--color-action-primary-text', '--color-focus',
      ],
    },
    { title: 'Chart / Scrim', tokens: ['--color-chart-series-1', '--color-chart-series-2', '--color-scrim'] },
  ];

  readonly badges = [
    'active', 'inactive', 'pending', 'deleted', 'rejected', 'admin', 'member',
    'training-completed', 'training-progress',
    'ministry-active', 'group-leader',
  ] as const;

  readonly categories = [
    'next-leader', 'discipleship', 'one-on-one-completed', 'one-on-one-progress',
    'one-on-one-waiting', 'qbs', 'unbaptized',
  ] as const;

  readonly elevations = ['sm', 'md', 'lg'] as const;

  readonly textStyles = [
    'display', 'h1', 'h2', 'h3', 'body', 'body-sm', 'caption', 'overline',
  ] as const;

  readonly densityTokens = [
    '--size-sidebar', '--size-topbar', '--space-page', '--space-card', '--space-gutter',
    '--size-control-md', '--size-control-sm', '--size-icon-button', '--size-icon-button-sm',
    '--size-table-row', '--font-display', '--font-h1', '--font-h2',
    '--radius-sm', '--radius-md', '--radius-lg', '--radius-full',
  ] as const;

  @HostListener('window:resize')
  onResize(): void {
    this.tick.update(value => value + 1);
  }

  viewport(): number {
    this.tick();
    return window.innerWidth;
  }

  /** Mirrors the breakpoints in §3 of styles.scss. */
  densityMode(): string {
    const width = this.viewport();
    if (width < 834) return 'Phone';
    return width < 1440 ? 'Tablet' : 'Desktop';
  }

  cssVar(token: string): string {
    return `var(${token})`;
  }

  resolved(token: string): string {
    this.tick();
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '—';
  }

  /** Reads the rendered font-size of a .type-* class, so the table cannot lie. */
  fontSize(className: string): string {
    this.tick();
    const sample = document.querySelector(`.${className}`);
    return sample ? getComputedStyle(sample).fontSize : '—';
  }
}
