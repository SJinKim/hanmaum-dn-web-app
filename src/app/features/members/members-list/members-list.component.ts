import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { Subject, debounceTime, firstValueFrom, take } from 'rxjs';
import { injectAppLang } from '../../../core/i18n/language';
import {
  catalogEntryByName,
  trainingLabelForName,
} from '../../../core/models/member-activity.model';
import {
  Baptism,
  ChurchGroupSummary,
  MemberStatus,
  MemberSummary,
} from '../../../core/models/member.model';
import { TrainingCatalogService } from '../../../core/services/training-catalog.service';
import { AvatarComponent } from '../../../core/ui/avatar/avatar.component';
import { BadgeComponent } from '../../../core/ui/badge/badge.component';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { DataRecord } from '../../../core/ui/data-record.model';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { FilterChipComponent } from '../../../core/ui/filter-chip/filter-chip.component';
import { ListCardComponent } from '../../../core/ui/list-card/list-card.component';
import { MemberPillComponent } from '../../../core/ui/member-pill/member-pill.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../../core/ui/search-field/search-field.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { ToolbarComponent } from '../../../core/ui/toolbar/toolbar.component';
import { BadgeVariant, MemberPillStage, resolveBadgeVariant } from '../../../core/ui/variant-tokens';
import { MemberService } from '../member.service';

/** 상태 chips, in the Figma order — not the enum's declaration order. */
const STATUS_FILTERS: readonly MemberStatus[] = ['PENDING', 'ACTIVE', 'INACTIVE', 'DELETED'];

/** 세례 select options, in the catechetical order the church uses. */
const BAPTISM_FILTERS: readonly Baptism[] = [
  'UNBAPTIZED',
  'INFANT_BAPTIZED',
  'GENERAL_BAPTIZED',
  'CONFIRMATION',
];

/** Milliseconds a keystroke waits before it becomes a request. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * MemberPill colour per catalog code, so a 양육 tag keeps the colour the stage
 * of the same name already has (`core/models/member-stage.ts`). Courses outside
 * these three have no colour of their own and render neutral — a new token per
 * catalog entry would have to come from Figma, not from here.
 */
const STAGE_BY_TRAINING_CODE: Readonly<Record<string, MemberPillStage>> = {
  QT_BASIC_SEMINAR: 'qbs',
  ONE_ON_ONE: 'one-on-one-completed',
  YOUTH_POWER_DISCIPLESHIP: 'discipleship',
};

/** One 양육 tag: the course name plus the pill colour it is drawn in. */
interface TrainingTag {
  readonly label: string;
  readonly stage: MemberPillStage;
}

/**
 * Figma: 청년 / Desktop 201:4937. The Tablet and Phone node IDs quoted in #53
 * point at the 통계 screen (noted on the issue), so both follow the Home
 * precedent instead: below 834px the table becomes a list of `app-list-card`,
 * never a horizontally scrolling table.
 *
 * The table is hand-built rather than `app-data-table`, for the same reason
 * Home's two tables are (`home.component.ts:43-46`): `DataRecord` carries one
 * badge and one subtitle, and this table needs three text columns plus a
 * MemberPill. Widening `DataRecord` is a UI-kit follow-up, not a Members change.
 *
 * Filter, page and result live in {@link MemberService}, per #53 — the Home
 * deep-link `/members?status=PENDING` and the approve flow write the same state.
 * Every list request is a real `Page<T>` request; nothing is filtered or sorted
 * in the client.
 */
@Component({
  selector: 'app-members-list',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    SelectModule,
    ToastModule,
    PageHeaderComponent,
    ToolbarComponent,
    SearchFieldComponent,
    FilterChipComponent,
    AvatarComponent,
    BadgeComponent,
    MemberPillComponent,
    ListCardComponent,
    EmptyStateComponent,
    SkeletonComponent,
  ],
  providers: [MessageService],
  // The host is what `<router-outlet>` inserts into `<main>`; without a height
  // of its own it is an auto-sized inline box and the `h-full` inside resolves
  // to nothing. The list has to fill the main area so the table can scroll in
  // the card instead of the page scrolling as a whole.
  host: { class: 'flex h-full flex-col' },
  templateUrl: './members-list.component.html',
})
export class MembersListComponent implements OnInit {
  private readonly memberService = inject(MemberService);
  private readonly trainingCatalog = inject(TrainingCatalogService);
  private readonly breakpoints = inject(BreakpointService);
  private readonly translate = inject(TranslateService);
  private readonly lang = injectAppLang();
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  // List state — read from the service, never duplicated here.
  readonly members = this.memberService.members;
  readonly total = this.memberService.total;
  readonly loading = this.memberService.listLoading;
  readonly failed = this.memberService.listFailed;
  readonly page = this.memberService.page;
  readonly size = this.memberService.size;
  readonly status = this.memberService.status;
  readonly baptism = this.memberService.baptism;
  readonly pendingCount = this.memberService.pendingCount;

  readonly isPhone = this.breakpoints.isPhone;

  readonly statusFilters = STATUS_FILTERS;

  /** Church groups for the approve select; empty until the request lands. */
  private readonly churchGroups = signal<readonly ChurchGroupSummary[]>([]);
  readonly groupOptions = computed(() =>
    this.churchGroups().map(group => ({ label: group.name, value: group.publicId })),
  );

  /** `publicId` of the row whose group select is open, and of the row saving. */
  readonly selectingId = signal<string | null>(null);
  readonly approvingId = signal<string | null>(null);

  /** Search text mirrors the service so a reset clears the field too. */
  readonly searchText = signal(this.memberService.search());
  private readonly searchInput$ = new Subject<string>();

  /** Re-resolves on language change — `currentLang()` is the dependency. */
  readonly baptismOptions = computed(() => {
    this.translate.currentLang();
    return [
      { label: this.translate.instant('members.filters.baptismAll'), value: null },
      ...BAPTISM_FILTERS.map(value => ({
        label: this.translate.instant(`members.baptism.${value}`),
        value: value as Baptism | null,
      })),
    ];
  });

  /** True when the empty result is the work of a filter rather than an empty table. */
  readonly filtered = computed(
    () => !!this.memberService.search() || !!this.status() || !!this.baptism(),
  );

  /** Phone/Tablet: the same page rendered as `app-list-card`s (Home precedent). */
  readonly records = computed<readonly DataRecord[]>(() =>
    this.members().map(member => ({
      id: member.publicId,
      title: this.memberName(member),
      subtitle: member.groupName ?? this.translate.instant('members.unassigned'),
      badge: {
        variant: this.statusVariant(member),
        label: this.translate.instant(`members.status.${member.memberStatus}`),
      },
      meta: this.shortDate(member.updatedAt),
    })),
  );

  /** 1-based row window for `members.pagination.range`. */
  readonly rangeParams = computed(() => {
    const total = this.total();
    const first = total === 0 ? 0 : this.page() * this.size() + 1;
    return { from: first, to: Math.min((this.page() + 1) * this.size(), total), total };
  });

  /**
   * The 승인 column exists only while the page actually holds a PENDING row —
   * an always-present empty column would be a Figma deviation for nothing.
   */
  readonly showsApprove = computed(() => this.members().some(m => m.memberStatus === 'PENDING'));

  readonly hasPages = computed(() => this.total() > this.size());
  readonly lastPage = computed(() => Math.max(0, Math.ceil(this.total() / this.size()) - 1));

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => this.memberService.setSearch(term));

    // Deep link from Home (`home.component.ts:176`): `/members?status=PENDING`.
    // Reading it once is enough — nothing navigates back to this route with a
    // different query while the screen is up.
    this.route.queryParamMap
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        if (params.get('status') === 'PENDING') {
          this.memberService.setStatus('PENDING');
        } else {
          this.memberService.loadMembers();
        }
      });

    this.memberService.refreshPendingCount();

    // The approve select needs every group, not just those the page happens to show.
    this.memberService
      .getChurchGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: groups => this.churchGroups.set(groups),
        error: () => this.churchGroups.set([]),
      });

    // The 양육 tags resolve their names against the catalog; loading it refreshes
    // the cells on its own.
    this.trainingCatalog.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  onSearchChange(term: string): void {
    this.searchText.set(term);
    this.searchInput$.next(term);
  }

  onSearchCleared(): void {
    this.searchText.set('');
    this.memberService.setSearch('');
  }

  toggleStatus(value: MemberStatus, selected: boolean): void {
    this.memberService.setStatus(selected ? value : null);
  }

  onBaptismChange(value: Baptism | null): void {
    this.memberService.setBaptism(value);
  }

  resetFilters(): void {
    this.searchText.set('');
    this.memberService.resetFilters();
  }

  retry(): void {
    this.memberService.loadMembers();
  }

  prevPage(): void {
    this.memberService.setPage(this.page() - 1);
  }

  nextPage(): void {
    if (this.page() >= this.lastPage()) return;
    this.memberService.setPage(this.page() + 1);
  }

  // ── Approve (8. Spalte) ───────────────────────────────────────────────────
  // Figma 201:4937 has no approve column; until #54 ships the detail screen
  // there is no other path from 대기중 to 활동중, so the column stays and is
  // rendered only for PENDING rows. It is removable without replacement once
  // #54 lands.

  startApprove(member: MemberSummary, event: Event): void {
    event.stopPropagation();
    if (this.churchGroups().length === 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('members.toast.error'),
        detail: this.translate.instant('members.toast.groupsLoadFailed'),
      });
      return;
    }
    this.selectingId.set(member.publicId);
  }

  cancelApprove(event: Event): void {
    event.stopPropagation();
    this.selectingId.set(null);
  }

  async chooseGroup(member: MemberSummary, groupPublicId: string | null): Promise<void> {
    if (!groupPublicId) return;
    this.selectingId.set(null);
    this.approvingId.set(member.publicId);
    try {
      await firstValueFrom(this.memberService.approveMember(member.publicId, groupPublicId));
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('members.toast.error'),
        detail: this.translate.instant('members.toast.approveFailed'),
      });
      this.approvingId.set(null);
      return;
    }
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('members.toast.done'),
      detail: this.translate.instant('members.toast.approveSuccess'),
    });
    this.approvingId.set(null);
    this.memberService.loadMembers();
    this.memberService.refreshPendingCount();
  }

  // ── Cell helpers ──────────────────────────────────────────────────────────

  memberName(member: MemberSummary): string {
    return `${member.lastName}${member.firstName}`;
  }

  statusVariant(member: MemberSummary): BadgeVariant {
    return resolveBadgeVariant(member.memberStatus.toLowerCase());
  }

  /**
   * The member's completed courses as tags, in catalog order; a single 없음 tag
   * when there are none. The column used to show `memberPillStage()`, which
   * reduces every training to the highest one reached — a member who finished
   * 큐베세 *and* 제자반 only read as 제자반 (#82). The stage rule itself stays
   * where it is: the 순 matrix and its legend are built on it.
   */
  trainingTags(member: MemberSummary): readonly TrainingTag[] {
    const catalog = this.trainingCatalog.entries();
    const lang = this.lang();

    const tags = (member.trainings ?? [])
      .filter(training => training.status === 'COMPLETED')
      .map(training => ({
        entry: catalogEntryByName(catalog, training.name),
        label: trainingLabelForName(catalog, training.name, lang),
      }))
      // A course missing from the catalog has no sort order — it goes last
      // rather than jumping ahead of the courses that do have one. Comparing
      // the ranks instead of subtracting them keeps two such courses at
      // `0` rather than `Infinity - Infinity`, which is NaN.
      .sort((a, b) => {
        const rankA = a.entry?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.entry?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        return rankA === rankB ? 0 : rankA - rankB;
      })
      .map(({ entry, label }) => ({
        label,
        stage: (entry && STAGE_BY_TRAINING_CODE[entry.code]) ?? 'none',
      }));

    return tags.length > 0
      ? tags
      : [{ label: this.translate.instant('members.stage.none'), stage: 'none' as MemberPillStage }];
  }

  ministryLabel(member: MemberSummary): string {
    const ministries = member.activeMinistries ?? [];
    return ministries.length > 0 ? ministries.join(', ') : '—';
  }

  baptismLabel(value: Baptism | null | undefined): string {
    return value ? this.translate.instant(`members.baptism.${value}`) : '—';
  }

  /** `2026-09-18T…` → `2026.09.18`; the app registers no ko locale data. */
  shortDate(iso: string | null | undefined): string {
    return iso ? iso.slice(0, 10).replace(/-/g, '.') : '—';
  }

  goToDetail(publicId: string): void {
    void this.router.navigate(['/members', publicId]);
  }

  goToCreate(): void {
    void this.router.navigate(['/members', 'new']);
  }
}
