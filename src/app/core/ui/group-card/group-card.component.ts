import { Component, computed, input, model, output } from '@angular/core';
import { BadgeComponent } from '../badge/badge.component';
import { MemberPillComponent, MemberPillState } from '../member-pill/member-pill.component';
import { MEMBER_PILL_STAGES, MemberPillStage, memberPillTokens } from '../variant-tokens';

/** One member as the GroupCard renders it — the MemberPill inputs plus nothing else. */
export interface GroupCardMember {
  /** The member's name. */
  label: string;
  stage: MemberPillStage;
  /** Human-readable stage name — the non-colour signal. */
  stageLabel: string;
  state?: MemberPillState;
  /** Stable id, echoed back by `memberClicked`. */
  id?: string;
  /** Renders the pill as a button that emits `memberClicked` — 예비순장 지정/해제. */
  interactive?: boolean;
}

/** One segment of the distribution bar. */
interface DistributionSegment {
  stage: MemberPillStage;
  label: string;
  count: number;
  percent: number;
  color: string;
}

/** Highest stage first, matching the Figma stage axis order. */
const STAGE_RANK = new Map<MemberPillStage, number>(MEMBER_PILL_STAGES.map((stage, index) => [stage, index]));

/**
 * Figma: Data / GroupCard (214:586) — Expanded / Collapsed.
 *
 * "One 순 as an accordion card. The distribution bar shows how many members sit
 * at each cumulative stage and stays visible when collapsed; segment widths are
 * data (resize per instance, hide zero segments), colours are the
 * color/category/*-dot tokens. Expanded shows every member as a MemberPill in
 * the members slot, ordered highest stage first. hasMatch shows a Badge with the
 * number of members matching the active filter — used on collapsed cards so a
 * filter never hides information."
 *
 * The bar is the one place colour carries data on its own, so every segment gets
 * a `title` and the whole bar an `aria-label` listing stage and count in text.
 */
@Component({
  selector: 'app-group-card',
  standalone: true,
  imports: [BadgeComponent, MemberPillComponent],
  template: `
    <div
      class="bg-surface border-line-subtle shadow-elevation-sm flex w-full flex-col items-start gap-[var(--space-12)] rounded-[var(--radius-lg)] border p-[var(--space-16)]">
      <button
        class="flex w-full items-center gap-[var(--space-8)] overflow-clip text-left focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:2px]"
        type="button"
        [attr.aria-expanded]="expanded()"
        (click)="expanded.set(!expanded())">
        <i
          class="text-ink-muted pi shrink-0 text-[16px]"
          [class.pi-chevron-down]="expanded()"
          [class.pi-chevron-right]="!expanded()"
          aria-hidden="true"></i>
        <span class="flex min-w-px flex-1 flex-col gap-[var(--space-2)]">
          <span class="type-h3 text-ink-strong truncate">{{ groupName() }}</span>
          @if (leaderName()) {
            <span class="flex items-center gap-[var(--space-6)]">
              <span class="type-overline text-ink-muted">{{ leaderTermLabel() }}</span>
              <span class="size-[6px] shrink-0 rounded-[var(--radius-full)]" [style.background]="leaderDot()"></span>
              <span class="type-caption text-ink truncate">{{ leaderName() }}</span>
            </span>
          }
        </span>
        @if (matchCount() !== undefined) {
          <app-badge [label]="matchLabel() + ' ' + matchCount()" />
        }
        <span class="type-body-sm text-ink-muted shrink-0">{{ memberCount() }}{{ countSuffix() }}</span>
      </button>

      <span
        class="bg-surface-subtle flex h-[6px] w-full gap-[2px] overflow-clip rounded-[var(--radius-full)]"
        role="img"
        [attr.aria-label]="distributionLabel()">
        @for (segment of distribution(); track segment.stage) {
          <span
            [style.width.%]="segment.percent"
            [style.background]="segment.color"
            [attr.title]="segment.label + ' ' + segment.count"></span>
        }
      </span>

      @if (expanded()) {
        <span class="flex w-full flex-wrap items-start gap-[var(--space-6)]">
          @for (member of orderedMembers(); track member.id ?? member.label) {
            @if (member.interactive) {
              <button
                class="rounded-[var(--radius-full)] focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:2px]"
                type="button"
                (click)="memberClicked.emit(member)">
                <app-member-pill
                  [label]="member.label"
                  [stage]="member.stage"
                  [stageLabel]="member.stageLabel"
                  [state]="member.state ?? 'default'"
                  [candidateLabel]="candidateLabel()" />
              </button>
            } @else {
              <app-member-pill
                [label]="member.label"
                [stage]="member.stage"
                [stageLabel]="member.stageLabel"
                [state]="member.state ?? 'default'"
                [candidateLabel]="candidateLabel()" />
            }
          }
        </span>
      }
    </div>
  `,
})
export class GroupCardComponent {
  readonly groupName = input.required<string>();
  readonly members = input<readonly GroupCardMember[]>([]);
  readonly leaderName = input<string>();
  /** Drives the leader dot colour; Figma shows the leader's own stage. */
  readonly leaderStage = input<MemberPillStage>('discipleship');
  /** Number of members matching the active filter — omit when no filter is on. */
  readonly matchCount = input<number | undefined>(undefined);
  readonly expanded = model(false);

  readonly leaderTermLabel = input('순장');
  readonly matchLabel = input('일치');
  readonly countSuffix = input('명');
  readonly candidateLabel = input('+ 지정');

  /** A pill marked `interactive` was clicked. */
  readonly memberClicked = output<GroupCardMember>();

  protected readonly memberCount = computed(() => this.members().length);

  protected readonly leaderDot = computed(() => memberPillTokens(this.leaderStage()).dot);

  /** Highest stage first, per the Figma members slot. */
  protected readonly orderedMembers = computed(() =>
    [...this.members()].sort((a, b) => (STAGE_RANK.get(a.stage) ?? 99) - (STAGE_RANK.get(b.stage) ?? 99)),
  );

  /** Zero segments are dropped, so the bar never renders a 0%-wide sliver. */
  protected readonly distribution = computed<DistributionSegment[]>(() => {
    const members = this.members();
    if (members.length === 0) {
      return [];
    }
    return MEMBER_PILL_STAGES.flatMap(stage => {
      const matching = members.filter(member => member.stage === stage);
      if (matching.length === 0) {
        return [];
      }
      return [
        {
          stage,
          label: matching[0].stageLabel,
          count: matching.length,
          percent: (matching.length / members.length) * 100,
          color: memberPillTokens(stage).dot,
        },
      ];
    });
  });

  protected readonly distributionLabel = computed(() =>
    this.distribution()
      .map(segment => `${segment.label} ${segment.count}`)
      .join(', '),
  );
}
