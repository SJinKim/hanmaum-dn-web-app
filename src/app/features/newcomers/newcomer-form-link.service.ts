import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { CreateNewcomerFormLinkRequest, NewcomerFormLink } from '../../core/models/newcomer-form-link.model';

/** QR 등록 링크 (#44) — `NewcomerFormLinkController` of hanmaum-dn-server #182. */
@Injectable({ providedIn: 'root' })
export class NewcomerFormLinkService {
  private readonly api = inject(ApiService);

  /** Newest first; the order is the server's. */
  getLinks(): Observable<NewcomerFormLink[]> {
    return this.api.get<NewcomerFormLink[]>('/v1/newcomer-form-links');
  }

  /** The response is the only one that carries `token`. */
  createLink(req: CreateNewcomerFormLinkRequest): Observable<NewcomerFormLink> {
    return this.api.post<NewcomerFormLink>('/v1/newcomer-form-links', req);
  }

  /** Idempotent; the public link stops working at once. */
  revokeLink(publicId: string): Observable<NewcomerFormLink> {
    return this.api.post<NewcomerFormLink>(`/v1/newcomer-form-links/${publicId}/revoke`, {});
  }
}
