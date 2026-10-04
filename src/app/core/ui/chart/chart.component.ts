import {
  AfterViewInit,
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/** Figma axis: Type = Line / Bar / Donut. */
export type ChartType = 'line' | 'bar' | 'donut';

/** Chart.js names the donut controller `doughnut`; Figma calls it Donut. */
const CHART_JS_TYPE: Record<ChartType, 'line' | 'bar' | 'doughnut'> = {
  line: 'line',
  bar: 'bar',
  donut: 'doughnut',
};

/** One series — `label` is what the legend shows, so it is never optional. */
export interface ChartSeries {
  label: string;
  data: number[];
}

/** Tokens Chart.js needs as resolved colours; a canvas cannot read `var()`. */
interface ChartPalette {
  series: string[];
  text: string;
  grid: string;
}

/**
 * Figma: Data / Chart (125:406) — Type × State, plus the dark check (126:408).
 *
 * The Figma frames are drawn vectors ("Drawn, not live — vectors matching
 * Chart.js"), so this renders the real thing through PrimeNG's `p-chart` and
 * only the framing — card, title, 200px plot slot, bottom legend — is taken
 * literally from the design.
 *
 * Chart.js paints onto a canvas and cannot resolve `var(--token)`, so the
 * palette is read with `getComputedStyle` off *this component's own host*, not
 * `document.documentElement` — that way a `[data-theme="dark"]` ancestor wins
 * and the sandbox can show both themes side by side. The read happens once in
 * `ngAfterViewInit` and lands in a signal; never read the DOM inside a
 * `computed()`.
 *
 * Empty and loading are States in Figma, not separate components: loading draws
 * the Skeleton chart variant, empty the EmptyState.
 */
@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [ChartModule, EmptyStateComponent, SkeletonComponent],
  template: `
    <div
      class="bg-surface border-line-subtle shadow-elevation-sm flex w-full flex-col gap-[var(--space-12)] rounded-[var(--radius-lg)] border p-card"
      [attr.aria-busy]="loading()">
      <h3 class="type-h3 text-ink-strong">{{ heading() }}</h3>
      @if (loading()) {
        <app-skeleton variant="chart" />
      } @else if (isEmpty()) {
        <app-empty-state variant="no-data" [heading]="emptyHeading()" [description]="emptyDescription()" />
      } @else {
        <p-chart
          [type]="chartType()"
          [data]="chartData()"
          [options]="chartOptions()"
          [ariaLabel]="heading()"
          height="200px" />
      }
    </div>
  `,
})
export class ChartComponent implements AfterViewInit {
  readonly type = input<ChartType>('line');
  readonly heading = input.required<string>();
  readonly labels = input<string[]>([]);
  readonly series = input<ChartSeries[]>([]);
  readonly loading = input(false, { transform: booleanAttribute });
  readonly emptyHeading = input('데이터가 없습니다');
  readonly emptyDescription = input<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Empty until `ngAfterViewInit` resolves the tokens off the host element. */
  private readonly palette = signal<ChartPalette>({ series: [], text: '', grid: '' });

  protected readonly chartType = computed(() => CHART_JS_TYPE[this.type()]);

  protected readonly isEmpty = computed(() => this.series().every(series => series.data.length === 0));

  protected readonly chartData = computed(() => {
    const palette = this.palette();
    const labels = this.labels();
    if (this.type() === 'donut') {
      // A donut shows one series split across labels, so the colours sit per slice.
      const [first] = this.series();
      return {
        labels,
        datasets: [{ data: first?.data ?? [], backgroundColor: palette.series, borderWidth: 0 }],
      };
    }
    return {
      labels,
      datasets: this.series().map((series, index) => ({
        label: series.label,
        data: series.data,
        borderColor: palette.series[index % palette.series.length],
        backgroundColor: palette.series[index % palette.series.length],
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
        borderRadius: 4,
      })),
    };
  });

  protected readonly chartOptions = computed(() => {
    const palette = this.palette();
    const axis = {
      ticks: { color: palette.text, font: { size: 10, weight: 700 } },
      grid: { color: palette.grid, drawTicks: false },
      border: { display: false },
    };
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: { color: palette.text, boxWidth: 12, boxHeight: 3, font: { size: 10, weight: 700 } },
        },
      },
      scales: this.type() === 'donut' ? {} : { x: axis, y: { ...axis, beginAtZero: true } },
    };
  });

  ngAfterViewInit(): void {
    const styles = getComputedStyle(this.host.nativeElement);
    const read = (token: string) => styles.getPropertyValue(token).trim();
    this.palette.set({
      series: [read('--color-chart-series-1'), read('--color-chart-series-2')],
      text: read('--color-text-muted'),
      grid: read('--color-border-subtle'),
    });
  }
}
