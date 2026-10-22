import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, finalize, forkJoin, tap, throwError } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { RoleService } from '../../core/services/role.service';
import { GuideArea, GuideAreaSettings, GuideRoom } from './guide-area.model';

@Injectable()
export class GuideAreaService {
  private readonly api = inject(ApiService);
  private readonly roles = inject(RoleService);
  private readonly destroy = inject(DestroyRef);
  private readonly path = '/v1/guide/counting-areas';
  readonly areas = signal<GuideArea[]>([]);
  readonly orderDraft = signal<GuideArea[] | null>(null);
  readonly ordering = computed(() => this.orderDraft() !== null);
  readonly displayedAreas = computed(() => this.orderDraft() ?? this.areas());
  readonly orderDirty = computed(() => this.orderDraft()?.some((area, i) => area.areaPublicId !== this.areas()[i]?.areaPublicId) ?? false);
  readonly moved = signal<{ label: string; position: number; total: number } | null>(null);
  readonly writeBlocked = computed(() => this.failure() === 'conflict' || this.failure() === 'notFound');
  readonly rooms = signal<GuideRoom[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadFailed = signal(false);
  readonly failure = signal<'save' | 'conflict' | 'notFound' | null>(null);
  readonly fieldErrors = signal<Readonly<Record<string, string>>>({});

  load(): void {
    this.clearFailure();
    this.loading.set(true);
    this.loadFailed.set(false);
    forkJoin({ areas: this.api.get<GuideArea[]>(this.path), rooms: this.api.get<GuideRoom[]>(`${this.path}/rooms`) })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false)))
      .subscribe({
        next: data => { this.areas.set(this.sorted(data.areas)); this.rooms.set(data.rooms); },
        error: () => this.loadFailed.set(true),
      });
  }

  roomIsEligible(publicId: string): boolean { return this.rooms().some(r => r.publicId === publicId); }

  clearFieldError(name: string): void {
    this.fieldErrors.update(errors => Object.fromEntries(Object.entries(errors).filter(([key]) => key !== name)));
  }

  clearFailure(): void { this.failure.set(null); this.fieldErrors.set({}); }

  save(settings: GuideAreaSettings, original: GuideArea | null) {
    if (!this.canMutate() || this.ordering()) {
      return throwError(() => new Error('Guide write not available'));
    }
    this.clearFailure();
    this.saving.set(true);
    const request = original
      ? this.api.put<GuideArea>(`${this.path}/${original.areaPublicId}`, { ...settings, version: original.version })
      : this.api.post<GuideArea>(this.path, settings);
    return request.pipe(
      tap(saved => {
        this.areas.update(list => this.sorted([...list.filter(a => a.areaPublicId !== saved.areaPublicId), saved]));
        // Canonical normalization can also change other areas' positions/versions.
        this.load();
      }),
      catchError((error: unknown) => this.failed(error)),
      finalize(() => this.saving.set(false)),
    );
  }

  beginOrdering(): void {
    if (!this.canMutate() || this.ordering() || this.areas().length < 2) return;
    this.clearFailure(); this.moved.set(null); this.orderDraft.set([...this.areas()]);
  }

  move(from: number, to: number): void {
    const draft = this.orderDraft();
    if (!draft || !this.canMutate() || !Number.isInteger(from) || !Number.isInteger(to)
      || from < 0 || to < 0 || from >= draft.length || to >= draft.length || from === to) return;
    const next = [...draft]; const [area] = next.splice(from, 1); next.splice(to, 0, area);
    this.orderDraft.set(next); this.moved.set({ label: area.label, position: to + 1, total: next.length });
  }

  cancelOrdering(): void {
    if (this.saving()) return;
    this.orderDraft.set(null); this.moved.set(null); this.clearFailure();
  }

  saveOrder(): Observable<GuideArea[]> {
    const draft = this.orderDraft();
    if (!draft || !this.orderDirty() || !this.canMutate()) return throwError(() => new Error('Guide ordering not available'));
    return this.persistList(this.api.put<GuideArea[]>(`${this.path}/order`, {
      areas: draft.map(area => ({ areaPublicId: area.areaPublicId, version: area.version })),
    }));
  }

  remove(area: GuideArea): Observable<GuideArea[]> {
    if (!this.canMutate() || this.ordering() || area.active) return throwError(() => new Error('Guide removal not available'));
    return this.persistList(this.api.deleteData<GuideArea[]>(`${this.path}/${encodeURIComponent(area.areaPublicId)}?version=${area.version}`));
  }

  private canMutate(): boolean {
    return this.roles.canWrite('guide') && !this.saving() && !this.loading() && !this.loadFailed() && !this.writeBlocked();
  }

  private persistList(request: Observable<GuideArea[]>): Observable<GuideArea[]> {
    this.clearFailure(); this.saving.set(true);
    return request.pipe(
      tap(saved => { this.areas.set(this.sorted(saved)); this.orderDraft.set(null); this.moved.set(null); }),
      catchError((error: unknown) => this.failed(error)),
      finalize(() => this.saving.set(false)),
    );
  }

  private failed(error: unknown): Observable<never> {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    this.failure.set(status === 409 ? 'conflict' : status === 404 ? 'notFound' : 'save');
    if (status === 400 && error instanceof HttpErrorResponse) {
      const fields: unknown = error.error?.data?.fieldErrors;
      if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
        this.fieldErrors.set(Object.fromEntries(Object.entries(fields).filter(([, value]) => typeof value === 'string')));
      }
    }
    return throwError(() => error);
  }

  private sorted(list: GuideArea[]): GuideArea[] {
    return [...list].sort((a, b) => a.displayOrder - b.displayOrder || a.areaPublicId.localeCompare(b.areaPublicId));
  }
}
