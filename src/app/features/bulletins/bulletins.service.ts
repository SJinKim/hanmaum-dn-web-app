import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageResponse } from '../../core/models/api-response.model';
import { ApiService } from '../../core/services/api.service';
import {
  BulletinDefaults,
  BulletinEdition,
  BulletinEditionSummary,
  BulletinStatus,
  CreateBulletinRequest,
  UpdateBulletinRequest,
} from './bulletins.model';

const BASE = '/v1/admin/bulletins';

@Injectable({ providedIn: 'root' })
export class BulletinsService {
  private readonly api = inject(ApiService);

  list(page = 0, size = 50, status?: BulletinStatus): Observable<PageResponse<BulletinEditionSummary>> {
    return this.api.get<PageResponse<BulletinEditionSummary>>(BASE, { page, size, ...(status ? { status } : {}) });
  }

  defaults(): Observable<BulletinDefaults> {
    return this.api.get<BulletinDefaults>(`${BASE}/defaults`);
  }

  get(publicId: string): Observable<BulletinEdition> {
    return this.api.get<BulletinEdition>(`${BASE}/${publicId}`);
  }

  create(req: CreateBulletinRequest): Observable<BulletinEdition> {
    return this.api.post<BulletinEdition>(BASE, req);
  }

  update(publicId: string, req: UpdateBulletinRequest): Observable<BulletinEdition> {
    return this.api.put<BulletinEdition>(`${BASE}/${publicId}`, req);
  }

  /** Publishes what the server holds, so unsaved edits must be saved first. */
  publish(publicId: string): Observable<BulletinEdition> {
    return this.api.post<BulletinEdition>(`${BASE}/${publicId}/publish`, {});
  }

  withdraw(publicId: string): Observable<BulletinEdition> {
    return this.api.post<BulletinEdition>(`${BASE}/${publicId}/withdraw`, {});
  }

  /** Only a draft that never had a VOL can be deleted. */
  delete(publicId: string): Observable<void> {
    return this.api.delete(`${BASE}/${publicId}`);
  }
}
