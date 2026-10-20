import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, forkJoin, tap, throwError } from 'rxjs';
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
  readonly rooms = signal<GuideRoom[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadFailed = signal(false);
  readonly failure = signal<'save' | 'conflict' | 'notFound' | null>(null);
  readonly fieldErrors = signal<Readonly<Record<string, string>>>({});

  load(): void {
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
    if (!this.roles.canWrite('guide') || this.saving() || this.failure() === 'conflict' || this.failure() === 'notFound') {
      return throwError(() => new Error('Guide write not available'));
    }
    this.clearFailure();
    this.saving.set(true);
    const request = original
      ? this.api.put<GuideArea>(`${this.path}/${original.areaPublicId}`, { ...settings, version: original.version })
      : this.api.post<GuideArea>(this.path, settings);
    return request.pipe(
      tap(saved => this.areas.update(list => this.sorted([...list.filter(a => a.areaPublicId !== saved.areaPublicId), saved]))),
      catchError((error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.failure.set(status === 409 ? 'conflict' : status === 404 ? 'notFound' : 'save');
        if (status === 400 && error instanceof HttpErrorResponse) {
          const fields: unknown = error.error?.data?.fieldErrors;
          if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
            this.fieldErrors.set(Object.fromEntries(Object.entries(fields).filter(([, v]) => typeof v === 'string')));
          }
        }
        return throwError(() => error);
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  private sorted(list: GuideArea[]): GuideArea[] {
    return [...list].sort((a, b) => a.displayOrder - b.displayOrder || a.areaPublicId.localeCompare(b.areaPublicId));
  }
}
