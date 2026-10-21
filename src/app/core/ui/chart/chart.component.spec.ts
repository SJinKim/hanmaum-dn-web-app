import { TestBed } from '@angular/core/testing';

import { ChartComponent, ChartSeries, ChartType } from './chart.component';

/** The computed Chart.js config is protected; the spec reads it through this view. */
interface ChartInternals {
  chartData(): { datasets: { label?: string; borderDash?: number[]; data?: (number | null)[]; spanGaps?: boolean; pointRadius?: number; borderColor?: string }[] };
  chartOptions(): {
    indexAxis: string;
    plugins: { tooltip: { callbacks: { label(item: unknown): string } } };
    scales: { x?: { ticks: { callback(value: number): string } }; y?: { ticks: { callback(value: number): string } } };
  };
}

describe('ChartComponent', () => {
  function render(type: ChartType, series: ChartSeries[], valueSuffix?: string) {
    const fixture = TestBed.createComponent(ChartComponent);
    fixture.componentRef.setInput('type', type);
    fixture.componentRef.setInput('heading', '성장 추이');
    fixture.componentRef.setInput('labels', ['7월', '8월']);
    fixture.componentRef.setInput('series', series);
    if (valueSuffix !== undefined) fixture.componentRef.setInput('valueSuffix', valueSuffix);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as ChartInternals;
  }

  it('preserves null gaps and explicitly disables spanning them', () => {
    const chart = render('line', [{ label: 'Total', data: [0, null, 7] }]);
    expect(chart.chartData().datasets[0].data).toEqual([0, null, 7]);
    expect(chart.chartData().datasets[0].spanGaps).toBeFalse();
    expect(chart.chartData().datasets[0].pointRadius).toBeGreaterThan(0);
  });

  it('uses the value axis for horizontal service-share bars', () => {
    const fixture = TestBed.createComponent(ChartComponent);
    fixture.componentRef.setInput('type', 'bar'); fixture.componentRef.setInput('heading', 'Shares');
    fixture.componentRef.setInput('horizontal', true); fixture.componentRef.setInput('valueSuffix', '%');
    fixture.componentRef.setInput('series', [{ label: 'Share', data: [25] }]); fixture.detectChanges();
    const options = (fixture.componentInstance as unknown as ChartInternals).chartOptions();
    expect(options.indexAxis).toBe('y'); expect(options.scales.x?.ticks.callback(25)).toBe('25%');
  });

  it('refreshes canvas colors after a mounted theme changes', async () => {
    const fixture = TestBed.createComponent(ChartComponent);
    fixture.componentRef.setInput('heading', 'Theme'); fixture.componentRef.setInput('series', [{ label: 'Total', data: [1] }]);
    fixture.nativeElement.style.setProperty('--color-chart-series-1', '#111111'); fixture.detectChanges();
    const chart = fixture.componentInstance as unknown as ChartInternals;
    expect(chart.chartData().datasets[0].borderColor).toBe('#111111');
    fixture.nativeElement.style.setProperty('--color-chart-series-1', '#eeeeee'); fixture.nativeElement.setAttribute('data-theme', 'dark');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(chart.chartData().datasets[0].borderColor).toBe('#eeeeee');
  });

  it('dashes only the series marked dashed', () => {
    const chart = render('line', [
      { label: '2026년', data: [80, 84] },
      { label: '2025년', data: [70, 72], dashed: true },
    ]);
    const [current, previous] = chart.chartData().datasets;
    expect(current.borderDash).toEqual([]);
    expect(previous.borderDash).toEqual([6, 4]);
  });

  it('appends the value suffix to the y ticks and the tooltip', () => {
    const options = render('bar', [{ label: '출석률', data: [61.5] }], ' %').chartOptions();
    expect(options.scales.y?.ticks.callback(60)).toBe('60 %');
    expect(options.plugins.tooltip.callbacks.label({ label: '7월', formattedValue: '61.5', dataset: { label: '출석률' } }))
      .toBe('출석률: 61.5 %');
  });

  it('leaves values bare without a suffix', () => {
    const options = render('bar', [{ label: '사역별 인원', data: [12] }]).chartOptions();
    expect(options.scales.y?.ticks.callback(12)).toBe('12');
  });

  it('names the slice in a donut tooltip, which has no dataset label', () => {
    const options = render('donut', [{ label: '성별 분포', data: [52, 48] }], ' %').chartOptions();
    expect(options.scales.y).toBeUndefined();
    expect(options.plugins.tooltip.callbacks.label({ label: '자매', formattedValue: '52', dataset: {} }))
      .toBe('자매: 52 %');
  });
});
