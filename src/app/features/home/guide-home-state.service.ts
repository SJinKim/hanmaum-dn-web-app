import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, switchMap, fromEvent, merge, of, timer, tap, finalize, shareReplay } from 'rxjs';
import { GuideHomeSnapshot } from '../../core/models/guide-home.model';
import { GuideHomeApi } from '../../core/services/guide-home-api.service';

/** A new instance on every Home entry means a return from save always loads immediately. */
@Injectable()
export class GuideHomeState {
  private readonly api = inject(GuideHomeApi);
  private readonly document = inject(DOCUMENT);
  private readonly destroy = inject(DestroyRef);
  private readonly refresh = new Subject<void>();
  readonly snapshot = signal<GuideHomeSnapshot | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly failed = signal(false);
  private started = false;
  private inFlight: Observable<GuideHomeSnapshot> | null = null;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.refresh.pipe(switchMap(() => this.fresh().pipe(catchError(() => of(null)))), takeUntilDestroyed(this.destroy)).subscribe();
    const window = this.document.defaultView;
    if (window) merge(fromEvent(window, 'focus'), fromEvent(this.document, 'visibilitychange'))
      .pipe(takeUntilDestroyed(this.destroy)).subscribe(() => { if (this.document.visibilityState === 'visible') this.reload(); });
    timer(30000, 30000).pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      if (this.document.visibilityState === 'visible' && this.isSunday()) this.reload();
    });
    this.reload();
  }
  reload(): void { this.refresh.next(); }
  /** Also used after the fresh pre-navigation lookup; never replace newer successful data. */
  accept(value: GuideHomeSnapshot): void {
    const current = this.snapshot();
    if (!current || Date.parse(value.asOf) >= Date.parse(current.asOf)) this.snapshot.set(value);
  }
  /** Polling and entry lookups share an in-flight read, so requests never overlap. */
  fresh(): Observable<GuideHomeSnapshot> {
    if (!this.inFlight) {
      this.refreshing.set(true);
      this.inFlight = this.api.get().pipe(tap({
        next: value => { this.accept(value); this.failed.set(false); },
        error: () => this.failed.set(true),
      }), finalize(() => { this.loading.set(false); this.refreshing.set(false); this.inFlight = null; }),
      shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this.inFlight;
  }
  private isSunday(): boolean {
    const zone = this.snapshot()?.timeZone ?? 'Europe/Berlin';
    return new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(new Date()) === 'Sun';
  }
}
