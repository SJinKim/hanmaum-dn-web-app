import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, shareReplay, tap, catchError } from 'rxjs';

import { ApiService } from './api.service';
import { TrainingCatalogEntry } from '../models/member-activity.model';

/**
 * The admin training catalog, loaded once per session and shared by everything that
 * has to turn a member training into something readable: the grid chips, the grid
 * filter, the member detail page and the member edit form. It holds data only —
 * consumers pick the display language themselves via `injectAppLang()`.
 *
 * `activeOnly=false` on purpose — retired courses must still resolve for members who
 * completed them, and the consumers decide themselves whether to offer them for
 * selection (see `trainingOptions`).
 */
@Injectable({ providedIn: 'root' })
export class TrainingCatalogService {
  private readonly api = inject(ApiService);

  /** Latest loaded catalog. Empty until the first load resolves, or if it failed. */
  readonly entries = signal<TrainingCatalogEntry[]>([]);

  private request$?: Observable<TrainingCatalogEntry[]>;

  /**
   * The catalog, fetched at most once per session. A failed load resolves to an empty
   * catalog rather than erroring, so a caller's stream (e.g. the member form's init)
   * is never torn down by it — callers guard on emptiness instead.
   */
  load(): Observable<TrainingCatalogEntry[]> {
    this.request$ ??= this.api
      .get<TrainingCatalogEntry[]>('/v1/trainings/catalog', { activeOnly: false })
      .pipe(
        tap(entries => this.entries.set(entries)),
        catchError(() => {
          this.entries.set([]);
          return of<TrainingCatalogEntry[]>([]);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.request$;
  }
}
