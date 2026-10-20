import { Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Subject, catchError, map, merge, switchMap, tap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyStateComponent } from '../../core/ui/empty-state/empty-state.component';
import { SkeletonComponent } from '../../core/ui/skeleton/skeleton.component';
import { GuideReportsApi } from './guide-reports-api.service';
import { GuideReportMode } from './guide-report.model';
import { GuideAttendanceComponent } from './guide-attendance.component';
import { GuideSummaryEditorComponent } from './guide-summary-editor.component';
@Component({
  selector: 'app-guide-report-editor', standalone: true,
  imports: [TranslatePipe, EmptyStateComponent, SkeletonComponent, GuideAttendanceComponent, GuideSummaryEditorComponent],
  host: { class: 'block min-w-0' },
  template: `
    @if (navigationBlocked()) { <p role="status" class="type-body-sm text-ink-strong">{{ 'guide.reports.waitForSave' | translate }}</p> }
    @if (loading()) { <div role="status"><span class="sr-only">{{ 'guide.reports.loading' | translate }}</span><app-skeleton variant="chart" /></div> }
    @else if (failed()) { <app-empty-state variant="error" [heading]="(notFound() ? 'guide.reports.notFound' : 'guide.reports.loadFailed') | translate" [actionLabel]="'guide.reports.retry' | translate" (action)="load()" /> }
    @else if (mode() === 'SUMMARY_ONLY') { <app-guide-summary-editor /> }
    @else if (mode() === 'DETAILED') { <app-guide-attendance /> }
  `,
})
export class GuideReportEditorComponent {
  private readonly api = inject(GuideReportsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private readonly summary = viewChild(GuideSummaryEditorComponent);
  private readonly detail = viewChild(GuideAttendanceComponent);
  private readonly reloads = new Subject<void>();
  readonly mode = signal<GuideReportMode | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly notFound = signal(false);
  readonly routeConfirming = signal(false);
  readonly navigationBlocked = signal(false);
  readonly state = { saving: computed(() => this.summary()?.state.saving() || this.detail()?.state.saving() || false) };
  constructor() {
    effect(() => { if (!this.state.saving()) this.navigationBlocked.set(false); });
    merge(this.route.paramMap.pipe(map(params => params.get('publicId') ?? '')),
      this.reloads.pipe(map(() => this.route.snapshot.paramMap.get('publicId') ?? ''))).pipe(switchMap(id => {
      this.loading.set(true); this.failed.set(false); this.notFound.set(false); this.mode.set(null);
      return this.api.get(id).pipe(tap(report => {
        if (!['SUMMARY_ONLY', 'DETAILED'].includes(report.reportMode)) throw new Error('Unsupported report mode');
        this.mode.set(report.reportMode); this.loading.set(false);
      }), catchError((error: unknown) => { this.notFound.set(error instanceof HttpErrorResponse && error.status === 404); this.failed.set(true); this.loading.set(false); return EMPTY; }));
    }), takeUntilDestroyed(this.destroy)).subscribe();
  }
  load(): void { this.reloads.next(); }
  hasUnsavedChanges(): boolean { return this.state.saving() || !!this.summary()?.hasUnsavedChanges() || !!this.detail()?.hasUnsavedChanges(); }
}
