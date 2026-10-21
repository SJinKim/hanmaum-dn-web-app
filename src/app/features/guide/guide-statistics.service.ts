import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { GuideStatistics } from './guide-statistics.model';

@Injectable()
export class GuideStatisticsService {
  private readonly api = inject(ApiService);
  private readonly requests = new Subject<{ year: number; asOf?: string }>();
  readonly year = signal(new Date().getFullYear());
  readonly asOf = signal('');
  private readonly requestedAsOf = signal('');
  readonly data = signal<GuideStatistics | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);

  constructor() {
    this.requests.pipe(switchMap(query => this.api.get<GuideStatistics>('/v1/guide/worship-counts/statistics', query).pipe(
      map(data => ({ data, failed: false })), catchError(() => of({ data: null, failed: true })),
    )), takeUntilDestroyed(inject(DestroyRef))).subscribe(result => {
      this.data.set(result.data); this.failed.set(result.failed); this.loading.set(false);
      if (result.data) this.asOf.set(result.data.asOf);
    });
  }
  load(year = this.year(), asOf = this.requestedAsOf()): void {
    if (!Number.isInteger(year) || year < 2 || year > 9999) return;
    if (asOf && (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number(asOf.slice(0, 4)) !== year)) return;
    this.year.set(year); this.requestedAsOf.set(asOf); this.asOf.set(asOf); this.data.set(null); this.failed.set(false); this.loading.set(true);
    this.requests.next(asOf ? { year, asOf } : { year });
  }
}
