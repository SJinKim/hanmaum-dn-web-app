import { TrainingCatalogEntry } from './member-activity.model';
import { memberPillStage, memberPillStageKey } from './member-stage';
import { MemberSummary } from './member.model';

/**
 * The catalog is deliberately built so the names overlap the way the real one
 * does: "One-to-One Discipleship Training" contains "Discipleship". A rule that
 * matched on name substrings would put 1대1 members into 제자반.
 */
const catalog: TrainingCatalogEntry[] = [
  entry('QT_BASIC_SEMINAR', 'QT Basic Seminar', '큐베세', 1),
  entry('ONE_ON_ONE', 'One-to-One Discipleship Training', '일대일', 2),
  entry('YOUTH_POWER_DISCIPLESHIP', 'Youth Power Discipleship', '제자반', 3),
];

function entry(code: string, name: string, nameKo: string, sortOrder: number): TrainingCatalogEntry {
  return {
    publicId: `catalog-${code}`,
    code,
    name,
    nameKo,
    category: 'DISCIPLESHIP',
    sortOrder,
    hasCohorts: false,
    isActive: true,
    prerequisiteCode: null,
  };
}

function member(overrides: Partial<MemberSummary> = {}): MemberSummary {
  return {
    publicId: 'member-1',
    firstName: '길동',
    lastName: '홍',
    email: null,
    memberStatus: 'ACTIVE',
    role: 'MEMBER',
    baptism: 'GENERAL_BAPTIZED',
    groupPublicId: null,
    groupName: null,
    isGroupLeader: false,
    isNextGroupLeader: false,
    oneOnOneSignupFilled: false,
    trainings: [],
    activeMinistries: [],
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

describe('memberPillStage', () => {
  it('ranks 예비순장 above every training', () => {
    const stage = memberPillStage(
      member({
        isNextGroupLeader: true,
        trainings: [{ name: 'QT Basic Seminar', status: 'COMPLETED' }],
      }),
      catalog,
    );
    expect(stage).toBe('next-leader');
  });

  it('ranks 제자반 above a completed 일대일', () => {
    const stage = memberPillStage(
      member({
        trainings: [
          { name: 'One-to-One Discipleship Training', status: 'COMPLETED' },
          { name: 'Youth Power Discipleship', status: 'COMPLETED' },
        ],
      }),
      catalog,
    );
    expect(stage).toBe('discipleship');
  });

  it('separates a completed from a running 일대일', () => {
    const completed = memberPillStage(
      member({ trainings: [{ name: 'One-to-One Discipleship Training', status: 'COMPLETED' }] }),
      catalog,
    );
    const running = memberPillStage(
      member({ trainings: [{ name: 'One-to-One Discipleship Training', status: 'IN_PROGRESS' }] }),
      catalog,
    );
    expect(completed).toBe('one-on-one-completed');
    expect(running).toBe('one-on-one-progress');
  });

  it('moves a 큐베세 graduate to 대기 once the 일대일 signup is filled', () => {
    const trainings = [{ name: 'QT Basic Seminar', status: 'COMPLETED' as const }];
    expect(memberPillStage(member({ trainings }), catalog)).toBe('qbs');
    expect(memberPillStage(member({ trainings, oneOnOneSignupFilled: true }), catalog)).toBe(
      'one-on-one-waiting',
    );
  });

  it('falls back to 세례X when there is no training and no baptism', () => {
    expect(memberPillStage(member({ baptism: 'UNBAPTIZED' }), catalog)).toBe('unbaptized');
    expect(memberPillStage(member({ baptism: null }), catalog)).toBe('unbaptized');
  });

  it('is "none" for a baptized member without trainings', () => {
    expect(memberPillStage(member(), catalog)).toBe('none');
  });

  it('ignores a course that is not in the catalog', () => {
    const stage = memberPillStage(
      member({ trainings: [{ name: 'Some Retired Course', status: 'COMPLETED' }] }),
      catalog,
    );
    expect(stage).toBe('none');
  });

  it('is "none" when the catalog has not loaded yet', () => {
    const stage = memberPillStage(
      member({ trainings: [{ name: 'Youth Power Discipleship', status: 'COMPLETED' }] }),
      [],
    );
    expect(stage).toBe('none');
  });
});

describe('memberPillStageKey', () => {
  it('namespaces the stage under members.stage', () => {
    expect(memberPillStageKey('qbs')).toBe('members.stage.qbs');
    expect(memberPillStageKey('none')).toBe('members.stage.none');
  });
});
