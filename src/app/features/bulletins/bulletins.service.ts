import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageResponse } from '../../core/models/api-response.model';
import { ApiService } from '../../core/services/api.service';
import {
  BulletinDefaults,
  BulletinEdition,
  BulletinEditionSummary,
  BulletinSectionKey,
  BulletinSectionTitle,
  BulletinService,
  BulletinServiceRequest,
  BulletinStatus,
  CreateBulletinRequest,
  UpdateBulletinRequest,
  UpdateSectionTitleRequest,
} from './bulletins.model';

const BASE = '/v1/admin/bulletins';
const SETTINGS = '/v1/admin/bulletin';

@Injectable({ providedIn: 'root' })
export class BulletinsService {
  private readonly api = inject(ApiService);

  list(page = 0, size = 50, status?: BulletinStatus): Observable<PageResponse<BulletinEditionSummary>> {
    return this.api.get<PageResponse<BulletinEditionSummary>>(BASE, { page, size, ...(status ? { status } : {}) });
  }

  defaults(from?: string): Observable<BulletinDefaults> {
    return this.api.get<BulletinDefaults>(`${BASE}/defaults`, from ? { from } : undefined);
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

  services(): Observable<BulletinService[]> {
    return this.api.get<BulletinService[]>(`${SETTINGS}/services`);
  }

  createService(req: BulletinServiceRequest): Observable<BulletinService> {
    return this.api.post<BulletinService>(`${SETTINGS}/services`, req);
  }

  updateService(publicId: string, req: BulletinServiceRequest): Observable<BulletinService> {
    return this.api.put<BulletinService>(`${SETTINGS}/services/${publicId}`, req);
  }

  /**
   * `null` = deleted. A service an edition uses is only deactivated; the server
   * then answers 200 with it.
   */
  deleteService(publicId: string): Observable<BulletinService | null> {
    return this.api.deleteOptional<BulletinService>(`${SETTINGS}/services/${publicId}`);
  }

  sectionTitles(): Observable<BulletinSectionTitle[]> {
    return this.api.get<BulletinSectionTitle[]>(`${SETTINGS}/section-titles`);
  }

  updateSectionTitle(key: BulletinSectionKey, req: UpdateSectionTitleRequest): Observable<BulletinSectionTitle> {
    return this.api.put<BulletinSectionTitle>(`${SETTINGS}/section-titles/${key}`, req);
  }
}
