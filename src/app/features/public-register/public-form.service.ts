import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  PublicNewcomerFormMetadata,
  PublicNewcomerSubmissionRequest,
  PublicNewcomerSubmissionResponse,
} from '../../core/models/public-newcomer-form.model';

/**
 * Public 새가족 등록 (#42) — `security: []`, the JWT interceptor leaves these
 * calls without a token (`isPublicApiUrl`).
 */
@Injectable({ providedIn: 'root' })
export class PublicFormService {
  private readonly api = inject(ApiService);

  /** 404 when the token is unknown, revoked or expired. */
  getForm(token: string): Observable<PublicNewcomerFormMetadata> {
    return this.api.get<PublicNewcomerFormMetadata>(`/v1/newcomer-forms/${encodeURIComponent(token)}`);
  }

  /** The same `idempotencyKey` on a retry makes the server return the first result. */
  submit(
    token: string,
    body: PublicNewcomerSubmissionRequest,
    idempotencyKey: string,
  ): Observable<PublicNewcomerSubmissionResponse> {
    return this.api.post<PublicNewcomerSubmissionResponse>(
      `/v1/newcomer-forms/${encodeURIComponent(token)}/submissions`,
      body,
      { 'Idempotency-Key': idempotencyKey },
    );
  }
}
