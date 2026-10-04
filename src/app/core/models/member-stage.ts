/**
 * The member's 양육 stage — the single business rule behind both the 순 matrix
 * (`features/church-groups`) and the 양육 column of the 청년 list (#53).
 *
 * It lived in `ChurchGroupsService.computeCategory` first; the Figma MemberPill
 * Stage axis (213:574) turned out to be exactly the same eight buckets, so the
 * rule moved here rather than being written a second time. `MemberCategory` is
 * now a thin alias over {@link MemberPillStage} — see `CATEGORY_BY_STAGE` there.
 *
 * Trainings are matched on the catalog's stable `code`, never on the DTO's
 * English name: those names overlap ("One-to-One Discipleship Training"
 * contains "Discipleship"), so a substring match sorts members into the wrong
 * stage. The join itself still goes through `catalogEntryByName` because the
 * summary DTO carries only the name — one place to change once the server ships
 * `code` (see the header of `member-activity.model.ts`).
 */

import { MemberPillStage } from '../ui/variant-tokens';
import { SummaryTraining, TrainingCatalogEntry, catalogEntryByName } from './member-activity.model';
import { MemberSummary } from './member.model';

/** Catalog codes the stages are built on. */
const QT_BASIC_SEMINAR = 'QT_BASIC_SEMINAR';
const ONE_ON_ONE = 'ONE_ON_ONE';
const YOUTH_POWER_DISCIPLESHIP = 'YOUTH_POWER_DISCIPLESHIP';

/**
 * The stage a member is at, highest reached first. Order matters: a member who
 * finished 제자반 is shown as 제자반, not as the 큐베세 they also hold.
 */
export function memberPillStage(
  member: MemberSummary,
  catalog: TrainingCatalogEntry[],
): MemberPillStage {
  if (member.isNextGroupLeader) return 'next-leader';

  const trainings: readonly SummaryTraining[] = member.trainings ?? [];
  const has = (code: string, status: string): boolean =>
    trainings.some(
      t => catalogEntryByName(catalog, t.name)?.code === code && t.status === status,
    );

  if (has(YOUTH_POWER_DISCIPLESHIP, 'COMPLETED')) return 'discipleship';
  if (has(ONE_ON_ONE, 'COMPLETED')) return 'one-on-one-completed';
  if (has(ONE_ON_ONE, 'IN_PROGRESS')) return 'one-on-one-progress';
  if (has(QT_BASIC_SEMINAR, 'COMPLETED') && member.oneOnOneSignupFilled) return 'one-on-one-waiting';
  if (has(QT_BASIC_SEMINAR, 'COMPLETED')) return 'qbs';
  if (!member.baptism || member.baptism === 'UNBAPTIZED') return 'unbaptized';
  return 'none';
}

/** i18n key for the stage name — the MemberPill's non-colour signal. */
export function memberPillStageKey(stage: MemberPillStage): string {
  return `members.stage.${stage}`;
}
