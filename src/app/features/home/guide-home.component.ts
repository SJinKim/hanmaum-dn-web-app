import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { GuideHomeCounts, GuideHomeReport } from '../../core/models/guide-home.model';
import { RoleService } from '../../core/services/role.service';
import { BadgeComponent } from '../../core/ui/badge/badge.component';
import { ChartComponent } from '../../core/ui/chart/chart.component';
import { EmptyStateComponent } from '../../core/ui/empty-state/empty-state.component';
import { SkeletonComponent } from '../../core/ui/skeleton/skeleton.component';
import { StatCardComponent } from '../../core/ui/stat-card/stat-card.component';
import { GuideHomeState } from './guide-home-state.service';

@Component({
  selector: 'app-guide-home', standalone: true, providers: [GuideHomeState],
  imports: [RouterLink, TranslatePipe, ButtonModule, BadgeComponent, ChartComponent, EmptyStateComponent, SkeletonComponent, StatCardComponent],
  templateUrl: './guide-home.component.html', host: { class: 'block min-w-0' },
})
export class GuideHomeComponent {
  readonly state = inject(GuideHomeState);
  private readonly roles = inject(RoleService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroy = inject(DestroyRef);
  private readonly language = toSignal(this.translate.onLangChange);
  readonly navigating = signal(false);
  readonly navigationFailed = signal(false);
  readonly canWrite = computed(() => this.roles.canWrite('guide'));
  readonly services = [1, 2, 3] as const;
  readonly report = computed(() => this.state.snapshot()?.attendance?.report ?? null);
  readonly line = computed(() => { this.language(); return [{ label: this.translate.instant('home.guide.total'), data: this.state.snapshot()?.timeline.map(point => point.totalCount) ?? [] }]; });
  readonly lineLabels = computed(() => this.state.snapshot()?.timeline.map(point => point.serviceDate) ?? []);
  readonly shareSeries = computed(() => { this.language(); return [{ label: this.translate.instant('home.guide.share'), data: this.state.snapshot()?.shares.map(share => share.percent) ?? [] }]; });
  readonly rooms = computed(() => [...(this.state.snapshot()?.attendance?.rooms ?? [])].sort((a, b) => a.displayOrder - b.displayOrder));
  constructor() { this.state.start(); }
  asOfLabel(): string {
    const data = this.state.snapshot();
    return data ? new Intl.DateTimeFormat(this.translate.getCurrentLang() === 'ko' ? 'ko-KR' : 'en-US', {
      timeZone: data.timeZone, dateStyle: 'short', timeStyle: 'short',
    }).format(new Date(data.asOf)) : '—';
  }
  date(value: string | null | undefined): string { return value ? value.replaceAll('-', '.') : '—'; }
  number(value: number | null | undefined, percent = false): string {
    return value == null ? '—' : value.toLocaleString(this.translate.getCurrentLang() === 'ko' ? 'ko-KR' : 'en-US', { maximumFractionDigits: 1 }) + (percent ? '%' : '');
  }
  delta(value: number | null | undefined): string { return value == null ? '—' : `${value > 0 ? '+' : ''}${this.number(value)}`; }
  rowCount(row: GuideHomeReport, service: 1 | 2 | 3): number | null { return row[`service${service}Count`]; }
  serviceCount(service: 1 | 2 | 3): number | null { return this.report()?.[`service${service}Count`] ?? null; }
  entry(area: string, service: number): number | null {
    return this.state.snapshot()?.attendance?.entries.find(entry => entry.areaPublicId === area && entry.serviceNumber === service)?.counts.totalCount ?? null;
  }
  composition(service: number): string {
    const counts = this.state.snapshot()?.attendance?.services.find(item => item.serviceNumber === service)?.counts;
    return counts ? this.compositionText(counts, service === 3) : '';
  }
  private compositionText(counts: GuideHomeCounts, youth: boolean): string {
    const fields: ('adultCount' | 'youthCount' | 'schoolCount')[] = youth ? ['adultCount', 'youthCount', 'schoolCount'] : ['adultCount', 'schoolCount'];
    return fields.map(field => `${this.translate.instant('home.guide.' + field)} ${this.number(counts[field])}`).join(' · ');
  }
  serviceLabels(): string[] { return this.services.map(service => this.translate.instant('home.guide.service', { service })); }
  previousLabel(): string {
    const data = this.state.snapshot(), date = this.report()?.serviceDate;
    return data && date && Date.parse(data.currentSunday + 'T00:00:00Z') - Date.parse(date + 'T00:00:00Z') === 7 * 86400000
      ? 'home.guide.previousRecord' : 'home.guide.latestRecord';
  }
  actionLabel(): string {
    const current = this.state.snapshot()?.currentSundayReport;
    return 'home.guide.' + (!current ? 'enter' : current.complete ? 'edit' : 'continue');
  }
  openCurrent(): void {
    if (!this.canWrite() || this.navigating()) return;
    this.navigating.set(true); this.navigationFailed.set(false);
    this.state.fresh().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: value => {
        this.state.accept(value);
        const report = value.currentSundayReport;
        void this.router.navigate(report ? ['/guide/records', report.publicId, 'edit'] : ['/guide/attendance/new'],
          report ? undefined : { queryParams: { date: value.currentSunday } }).then(() => this.navigating.set(false), () => {
            this.navigating.set(false); this.navigationFailed.set(true);
          });
      }, error: () => { this.navigating.set(false); this.navigationFailed.set(true); },
    });
  }
}
