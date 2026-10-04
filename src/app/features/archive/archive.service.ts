import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import { MemberSummary } from '../../core/models/member.model';
import { TrainingCatalogEntry, catalogEntryByName } from '../../core/models/member-activity.model';
import { TrainingCatalogService } from '../../core/services/training-catalog.service';
import { MemberService } from '../members/member.service';
import { ActiveMinistryMemberDto, MinistrySummary } from '../ministry/ministry.model';
import { MinistryService } from '../ministry/ministry.service';

/** One 양육 card: a catalog course and everyone who completed it. */
export interface TrainingArchive {
  entry: TrainingCatalogEntry;
  members: MemberSummary[];
}

/** One 사역 card: a ministry and its ended assignments. */
export interface MinistryArchive {
  ministry: MinistrySummary;
  members: ActiveMinistryMemberDto[];
}

/**
 * 기록 (#31) reads what the server already has — no archive endpoint needed.
 * 양육 comes from the member list's trainings joined on the catalog; 사역 from
 * each ministry's member history with `includeEnded`.
 */
@Injectable({ providedIn: 'root' })
export class ArchiveService {
  private readonly members = inject(MemberService);
  private readonly ministries = inject(MinistryService);
  private readonly catalog = inject(TrainingCatalogService);

  /**
   * One entry per catalog course in progression order. No status filter on the
   * member list: 졸업 members completed courses too. Deleted and pending
   * members are no part of the church's history.
   */
  loadTrainingArchive(): Observable<TrainingArchive[]> {
    return forkJoin({
      members: this.members.getMembers({ size: 9999 }).pipe(map(p => p.content)),
      catalog: this.catalog.load(),
    }).pipe(
      map(({ members, catalog }) => {
        const counted = members.filter(m => m.memberStatus === 'ACTIVE' || m.memberStatus === 'INACTIVE');
        return [...catalog]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(entry => ({
            entry,
            members: counted.filter(m => (m.trainings ?? []).some(
              t => t.status === 'COMPLETED' && catalogEntryByName(catalog, t.name)?.code === entry.code,
            )),
          }));
      }),
    );
  }

  /** One entry per ministry with its ended assignments, most recent 종료일 first. */
  loadMinistryArchive(): Observable<MinistryArchive[]> {
    return this.ministries.getMinistries().pipe(
      switchMap(ministries => ministries.length === 0
        ? of([])
        : forkJoin(ministries.map(ministry => this.ministries.getMemberHistory(ministry.publicId).pipe(
          map(history => ({
            ministry,
            members: history
              .filter(m => !!m.endDate)
              .sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? '')),
          })),
        )))),
    );
  }
}
