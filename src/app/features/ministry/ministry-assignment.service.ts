import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';

import { Member } from '../../core/models/member.model';
import { MemberMinistryItem, MinistryHistory } from '../../core/models/member-activity.model';
import { MemberService } from '../members/member.service';

/** The fields of one assignment the 사역 상세 can change today. */
export type AssignmentPatch = Partial<Pick<MemberMinistryItem, 'startDate' | 'endDate' | 'note'>>;

/**
 * Edits one member's assignment to one ministry from the ministry side.
 *
 * The server has no ministry-side endpoint yet (hanmaum-dn-server#214), so this
 * reads the member and PUTs their whole list back with only the ongoing
 * assignment to `ministryPublicId` changed. Reading right before writing keeps
 * the window in which a stale list could overwrite other assignments small.
 */
@Injectable({ providedIn: 'root' })
export class MinistryAssignmentService {
  private readonly memberService = inject(MemberService);

  updateAssignment(memberPublicId: string, ministryPublicId: string, patch: AssignmentPatch): Observable<Member> {
    return this.memberService.getMember(memberPublicId).pipe(
      switchMap(member => this.memberService.replaceMemberMinistries(
        memberPublicId,
        withAssignmentPatched(member.ministries ?? [], ministryPublicId, patch),
      )),
    );
  }

  /** Ends the ongoing assignment today. */
  endAssignment(memberPublicId: string, ministryPublicId: string, today: string): Observable<Member> {
    return this.updateAssignment(memberPublicId, ministryPublicId, { endDate: today });
  }
}

/**
 * The member's full list as request items, with `patch` applied to the ongoing
 * assignment to `ministryPublicId`. Ended assignments to the same ministry and
 * every other ministry pass through unchanged.
 */
export function withAssignmentPatched(
  ministries: readonly MinistryHistory[],
  ministryPublicId: string,
  patch: AssignmentPatch,
): MemberMinistryItem[] {
  return ministries.map(m => {
    const item: MemberMinistryItem = {
      ministryPublicId: m.ministryPublicId,
      startDate: m.startDate,
      endDate: m.endDate,
      note: m.note,
    };
    const isTarget = m.ministryPublicId === ministryPublicId && m.endDate === null;
    return isTarget ? { ...item, ...patch } : item;
  });
}
