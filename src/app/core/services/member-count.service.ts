import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MemberCountDto, MemberStatus } from '../models/member.model';
import { ApiService } from './api.service';

/**
 * `GET /v1/members/count` (hanmaum-dn-server#305). A number, not a page of
 * members — `note_taker` may ask it although `GET /members` answers 403 (#207).
 * Lives in `core/` so Home does not reach into `features/members` for it.
 */
@Injectable({ providedIn: 'root' })
export class MemberCountService {
  private readonly api = inject(ApiService);

  /** Without `status`, every member that is not deleted. */
  count(status?: MemberStatus | null): Observable<number> {
    return this.api
      .get<MemberCountDto>('/v1/members/count', status ? { status } : undefined)
      .pipe(map(dto => dto.count));
  }
}
