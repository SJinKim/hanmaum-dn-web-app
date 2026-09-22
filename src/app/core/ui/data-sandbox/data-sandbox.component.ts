import { Component } from '@angular/core';
import { AvatarComponent } from '../avatar/avatar.component';
import { BadgeComponent, BadgeSize } from '../badge/badge.component';
import { ChartComponent, ChartSeries, ChartType } from '../chart/chart.component';
import { DataTableComponent } from '../data-table/data-table.component';
import { DefinitionRowComponent } from '../definition-list/definition-row.component';
import { GroupCardComponent, GroupCardMember } from '../group-card/group-card.component';
import { IconTileComponent } from '../icon-tile/icon-tile.component';
import { ListCardComponent } from '../list-card/list-card.component';
import { MemberPillComponent, MemberPillState } from '../member-pill/member-pill.component';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { SkeletonComponent, SkeletonVariant } from '../skeleton/skeleton.component';
import { StatCardComponent } from '../stat-card/stat-card.component';
import { DataColumn, DataRecord } from '../data-record.model';
import { BADGE_VARIANTS, MEMBER_PILL_STAGES, MemberPillStage } from '../variant-tokens';

/** Human-readable stage names — the non-colour signal every pill must carry. */
const STAGE_LABELS: Record<MemberPillStage, string> = {
  'next-leader': '차기 리더',
  discipleship: '제자훈련',
  'one-on-one-completed': '1:1 완료',
  'one-on-one-progress': '1:1 진행',
  'one-on-one-waiting': '1:1 대기',
  qbs: 'QBS',
  unbaptized: '미세례',
  none: '없음',
};

/**
 * Living reference for the Figma Data layer (canvas "04 · Components — Data").
 *
 * Every variant in Light and Dark, so a token change or a new variant can be
 * checked in one place. Route: /design-data, not linked from the navigation.
 * Sibling of /design-tokens (#48) and /design-ui (#49).
 */
@Component({
  selector: 'app-data-sandbox',
  standalone: true,
  imports: [
    AvatarComponent,
    BadgeComponent,
    ChartComponent,
    DataTableComponent,
    DefinitionRowComponent,
    GroupCardComponent,
    IconTileComponent,
    ListCardComponent,
    MemberPillComponent,
    ProgressBarComponent,
    SkeletonComponent,
    StatCardComponent,
  ],
  template: `
    <div>
      <header class="mb-gutter">
        <h1 class="type-h1 text-ink-strong">Data Display</h1>
        <p class="type-body text-ink-muted mt-1">
          Figma "DN-Web" · 04 · Components — Data · Table / Badge / MemberPill / Chart
        </p>
      </header>

      @for (mode of modes; track mode) {
        <section
          class="border-line bg-surface-base mb-gutter rounded-[var(--radius-lg)] border p-card"
          [attr.data-theme]="mode">
          <h2 class="type-overline text-ink-muted mb-4">{{ mode }}</h2>

          <h3 class="type-h3 text-ink-strong mb-2">Badge — variant × size</h3>
          @for (size of badgeSizes; track size) {
            <div class="mb-3 flex flex-wrap items-center gap-2">
              @for (variant of badgeVariants; track variant) {
                <app-badge [variant]="variant" [label]="variant" [size]="size" />
              }
            </div>
          }

          <h3 class="type-h3 text-ink-strong mt-6 mb-2">MemberPill — stage × state</h3>
          @for (state of pillStates; track state) {
            <div class="mb-3 flex flex-wrap items-center gap-2">
              @for (stage of pillStages; track stage) {
                <app-member-pill
                  [label]="stageLabel(stage)"
                  [stage]="stage"
                  [stageLabel]="stageLabel(stage)"
                  [state]="state" />
              }
            </div>
          }

          <h3 class="type-h3 text-ink-strong mt-6 mb-2">Avatar · IconTile · ProgressBar</h3>
          <div class="mb-3 flex flex-wrap items-end gap-4">
            @for (size of avatarSizes; track size) {
              <app-avatar name="김승진" [size]="size" />
            }
            <app-icon-tile />
            <app-icon-tile icon="pi pi-chart-line" />
          </div>
          <div class="mb-6 grid max-w-md gap-4">
            <app-progress-bar size="small" [value]="72" label="72%" />
            <app-progress-bar size="medium" [value]="30" label="3 / 10" />
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">StatCard — NoDelta / WithDelta / Empty</h3>
          <div class="mb-6 grid gap-gutter sm:grid-cols-3">
            <app-stat-card label="전체 성도" value="248" subtext="지난 주와 동일" />
            <app-stat-card
              icon="pi pi-check-circle"
              label="출석"
              value="182"
              delta="+12%"
              [deltaBadge]="deltaBadge" />
            <app-stat-card icon="pi pi-inbox" label="사역 요청" value="—" subtext="데이터가 없습니다" />
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">Table — sort · hover · selected</h3>
          <div class="mb-4">
            <app-data-table [rows]="records" [columns]="columns" [selectedId]="'m-2'" />
          </div>
          <h3 class="type-h3 text-ink-strong mb-2">Table — loading · empty</h3>
          <div class="mb-6 grid gap-gutter">
            <app-data-table [rows]="[]" [columns]="columns" loading />
            <app-data-table [rows]="[]" [columns]="columns" emptyDescription="필터를 지우고 다시 시도하세요." />
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">ListCard — the Phone rendering of a row</h3>
          <div class="mb-6 grid max-w-sm gap-2">
            @for (record of records; track record.id) {
              <app-list-card [record]="record" />
            }
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">GroupCard — expanded / collapsed</h3>
          <div class="mb-6 grid gap-gutter lg:grid-cols-2">
            <app-group-card groupName="1순" leaderName="박지훈" [members]="groupMembers" [expanded]="true" />
            <app-group-card
              groupName="2순"
              leaderName="이수민"
              leaderStage="next-leader"
              [members]="groupMembers"
              [matchCount]="2" />
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">Chart — type × state</h3>
          <div class="mb-6 grid gap-gutter lg:grid-cols-3">
            @for (type of chartTypes; track type) {
              <app-chart [type]="type" [heading]="type" [labels]="chartLabels" [series]="chartSeries" />
            }
            <app-chart heading="로딩" loading />
            <app-chart heading="빈 상태" [series]="[]" />
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">DefinitionList — stacked / inline</h3>
          <div class="mb-6 grid gap-gutter sm:grid-cols-2">
            <dl class="grid gap-3">
              <app-definition-row term="이름" value="김승진" />
              <app-definition-row term="연락처" value="010-1234-5678" />
            </dl>
            <dl class="grid gap-3">
              <app-definition-row layout="inline" term="이름" value="김승진" />
              <app-definition-row layout="inline" term="연락처" value="010-1234-5678" />
            </dl>
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">Skeleton — line / card / chart</h3>
          <div class="grid max-w-md gap-4">
            @for (variant of skeletonVariants; track variant) {
              <app-skeleton [variant]="variant" />
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class DataSandboxComponent {
  readonly modes = ['light', 'dark'] as const;
  readonly badgeVariants = BADGE_VARIANTS;
  readonly badgeSizes: BadgeSize[] = ['small', 'medium'];
  readonly pillStages = MEMBER_PILL_STAGES;
  readonly pillStates: MemberPillState[] = ['default', 'dimmed', 'candidate'];
  readonly avatarSizes = [24, 32, 40, 56] as const;
  readonly skeletonVariants: SkeletonVariant[] = ['line', 'card', 'chart'];
  readonly chartTypes: ChartType[] = ['line', 'bar', 'donut'];

  readonly deltaBadge = { variant: 'active', label: '+12%' } as const;

  /** Mutable on purpose — `p-table` sorts the array it is given in place. */
  readonly columns: DataColumn[] = [
    { type: 'avatar-name', header: '이름', sortable: true },
    { type: 'text', header: '순', sortable: true },
    { type: 'badge', header: '상태', sortable: true },
    { type: 'date', header: '등록일', sortable: true },
    { type: 'progress', header: '훈련', sortable: true },
    { type: 'actions', header: '관리' },
  ];

  readonly records: DataRecord[] = [
    {
      id: 'm-1',
      title: '김승진',
      subtitle: '1순',
      badge: { variant: 'active', label: '활동' },
      meta: '2024-03-12',
      progress: { value: 72, label: '72%' },
    },
    {
      id: 'm-2',
      title: '박지훈',
      subtitle: '1순',
      badge: { variant: 'group-leader', label: '순장' },
      meta: '2023-11-02',
      progress: { value: 100, label: '완료' },
    },
    {
      id: 'm-3',
      title: '이수민',
      subtitle: '2순',
      badge: { variant: 'pending', label: '대기' },
      meta: '2025-01-20',
      progress: { value: 18, label: '18%' },
    },
  ];

  readonly groupMembers: GroupCardMember[] = [
    { label: '박지훈', stage: 'next-leader', stageLabel: STAGE_LABELS['next-leader'] },
    { label: '김승진', stage: 'discipleship', stageLabel: STAGE_LABELS['discipleship'] },
    { label: '이수민', stage: 'one-on-one-progress', stageLabel: STAGE_LABELS['one-on-one-progress'] },
    { label: '정하늘', stage: 'qbs', stageLabel: STAGE_LABELS['qbs'], state: 'dimmed' },
    { label: '최은지', stage: 'unbaptized', stageLabel: STAGE_LABELS['unbaptized'] },
  ];

  readonly chartLabels = ['3월', '4월', '5월', '6월', '7월', '8월'];
  readonly chartSeries: ChartSeries[] = [
    { label: '출석', data: [120, 132, 128, 145, 152, 148] },
    { label: '등록', data: [12, 8, 14, 9, 16, 11] },
  ];

  protected stageLabel(stage: MemberPillStage): string {
    return STAGE_LABELS[stage];
  }
}
