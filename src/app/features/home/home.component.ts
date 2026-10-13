import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap, timer } from 'rxjs';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MemberSummary } from '../../core/models/member.model';
import { NewcomerVisit } from '../../core/models/newcomer-visit.model';
import { HomeBlockId } from '../../core/navigation/home-blocks';
import { RoleService } from '../../core/services/role.service';
import { BadgeComponent } from '../../core/ui/badge/badge.component';
import { BreakpointService } from '../../core/ui/breakpoint.service';
import { DataColumn, DataRecord, DataRecordBadge } from '../../core/ui/data-record.model';
import { DataTableComponent } from '../../core/ui/data-table/data-table.component';
import { DefinitionRowComponent } from '../../core/ui/definition-list/definition-row.component';
import { EmptyStateComponent } from '../../core/ui/empty-state/empty-state.component';
import { IconTileComponent } from '../../core/ui/icon-tile/icon-tile.component';
import { ListCardComponent } from '../../core/ui/list-card/list-card.component';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../core/ui/section-header/section-header.component';
import {
  SegmentOption,
  SegmentedControlComponent,
} from '../../core/ui/segmented-control/segmented-control.component';
import { SkeletonComponent } from '../../core/ui/skeleton/skeleton.component';
import { BadgeVariant, resolveBadgeVariant } from '../../core/ui/variant-tokens';
import {
  ATTENDANCE_RANGES,
  AttendanceRange,
  GROUP_SIZE_CLASSES,
  GroupAttendanceRow,
  GroupSizeClass,
  HomeSnapshot,
  SundayCheckins,
  SundayGroupCounts,
  isSunday,
  totalAttendanceRow,
} from './home.model';
import { HomeService, QUICK_RECORD_PAGE_SIZE } from './home.service';

/**
 * Figma: Home / Desktop 188:169 (light), 188:2520 (dark), 228:171 (tablet),
 * 237:1901 (phone). The role matrix is 254:3 and lives in `core/navigation/
 * home-blocks.ts` — every block here asks `showsBlock()` and renders nothing
 * when the answer is no. DESIGN.md §9: a block a role may not see is *absent*,
 * never greyed out.
 *
 * Both tables (순별 참석 현황, 최근 활동) are `app-data-table`; the columns a
 * `DataRecord` has no named field for — 참석 + 전체, 역할 + 상태 — are `cells` (#69).
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    PageHeaderComponent,
    SectionHeaderComponent,
    SegmentedControlComponent,
    DefinitionRowComponent,
    BadgeComponent,
    DataTableComponent,
    IconTileComponent,
    ListCardComponent,
    EmptyStateComponent,
    SkeletonComponent,
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private readonly home = inject(HomeService);
  private readonly roles = inject(RoleService);
  private readonly breakpoints = inject(BreakpointService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The date the PageHeader prints, fixed for the life of the screen. Built by
   * hand rather than with `DatePipe`: the app registers no ko locale data, so
   * the pipe would format on en-US, and it returns `string | null`.
   */
  readonly todayLabel = formatToday(new Date());

  readonly loading = signal(true);
  readonly snapshot = signal<HomeSnapshot | null>(null);

  readonly range = signal<AttendanceRange>('last-sunday');
  readonly attendanceLoading = signal(true);
  readonly attendanceRows = signal<readonly GroupAttendanceRow[]>([]);

  readonly sundayCountsLoading = signal(true);
  readonly sundayCounts = signal<SundayGroupCounts | null>(null);
  /** A failed load is not an empty Sunday — it gets its own error state. */
  readonly sundayCountsFailed = signal(false);
  readonly checkinsLoading = signal(true);
  readonly checkins = signal<SundayCheckins | null>(null);
  readonly checkinsFailed = signal(false);
  /** `10:42` — when the tiles were last loaded, for 합계 · … 기준. */
  readonly checkinsUpdatedAt = signal<string | null>(null);
  /** On a Sunday the tiles refresh and carry the 실시간 badge (#206). */
  readonly checkinsLive = isSunday(new Date());

  /** 확인하기 only for a role that may open `/event-rsvps` — 총괄팀 may since #213. */
  readonly canOpenRsvps = computed(() => this.roles.canRead('eventRsvps'));
  readonly sizeClasses = GROUP_SIZE_CLASSES;

  /** 빠른 기록 · 최근 방문 (#202). */
  readonly quickLoading = signal(true);
  readonly quickFailed = signal(false);
  readonly quickVisits = signal<readonly NewcomerVisit[]>([]);
  readonly quickPage = signal(0);
  readonly quickTotal = signal(0);
  readonly quickSize = QUICK_RECORD_PAGE_SIZE;

  readonly quickRangeParams = computed(() => {
    const total = this.quickTotal();
    const first = total === 0 ? 0 : this.quickPage() * this.quickSize + 1;
    return { from: first, to: Math.min((this.quickPage() + 1) * this.quickSize, total), total };
  });

  readonly quickHasPages = computed(() => this.quickTotal() > this.quickSize);
  readonly quickLastPage = computed(() => Math.max(0, Math.ceil(this.quickTotal() / this.quickSize) - 1));

  readonly isPhone = this.breakpoints.isPhone;

  /** No block granted at all — the page says so instead of staying blank. */
  readonly showsNothing = computed(() => this.roles.homeBlocks().size === 0);

  /** Re-resolves on language change — `currentLang()` is the dependency. */
  readonly rangeOptions = computed<readonly SegmentOption[]>(() => {
    this.translate.currentLang();
    return ATTENDANCE_RANGES.map(value => ({
      value,
      label: this.translate.instant(`home.attendance.range.${value}`),
    }));
  });

  /** The 합계 row Figma pins under the 순 rows; absent while there are none. */
  readonly attendanceTotal = computed<GroupAttendanceRow | null>(() => {
    const rows = this.attendanceRows();
    return rows.length > 0 ? totalAttendanceRow(rows, this.translate.instant('home.attendance.totalRow')) : null;
  });

  /** 순별 참석 현황 as table rows; the title is also the progress bar's name. */
  readonly attendanceRecords = computed<DataRecord[]>(() =>
    this.attendanceRows().map(row => ({
      id: row.groupPublicId ?? row.groupName,
      title: row.groupName,
      cells: {
        group: row.groupName,
        attended: row.attended,
        total: row.total,
        ratio: { value: row.ratio, label: `${row.ratio}%` },
      },
    })),
  );

  /** The 합계 row as the table footer — its ratio is text, not a bar. */
  readonly attendanceFooter = computed<DataRecord | null>(() => {
    const total = this.attendanceTotal();
    return total
      ? {
          id: 'total',
          title: total.groupName,
          cells: { group: total.groupName, attended: total.attended, total: total.total, ratio: `${total.ratio}%` },
        }
      : null;
  });

  /** Re-resolves on language change — `currentLang()` is the dependency. */
  readonly attendanceColumns = computed<DataColumn[]>(() => {
    this.translate.currentLang();
    const header = (key: string) => this.translate.instant(`home.attendance.${key}`);
    return [
      { type: 'text', key: 'group', header: header('group'), tone: 'strong', sortable: false, width: 'auto' },
      { type: 'text', key: 'attended', header: header('attended'), align: 'end', sortable: false, width: '96px' },
      { type: 'text', key: 'total', header: header('total'), align: 'end', tone: 'muted', sortable: false, width: '96px' },
      { type: 'progress', key: 'ratio', header: header('ratio'), sortable: false, width: '160px' },
    ];
  });

  /** Desktop/Tablet 최근 활동: 역할 and 상태 are two badge cells side by side. */
  readonly recentTableRecords = computed<DataRecord[]>(() => {
    this.translate.currentLang();
    return (this.snapshot()?.recentActivity ?? []).map(member => ({
      id: member.publicId,
      title: this.memberName(member),
      cells: {
        role: { variant: this.roleVariant(member), label: this.translate.instant(this.roleLabelKey(member)) },
        status: {
          variant: this.statusVariant(member),
          label: this.translate.instant(`members.status.${member.memberStatus}`),
        },
        updated: this.shortDate(member.updatedAt),
      },
    }));
  });

  readonly recentColumns = computed<DataColumn[]>(() => {
    this.translate.currentLang();
    const header = (key: string) => this.translate.instant(`home.recent.${key}`);
    return [
      { type: 'avatar-name', key: 'name', header: header('name'), sortable: false, width: 'auto' },
      { type: 'badge', key: 'role', header: header('role'), sortable: false },
      { type: 'badge', key: 'status', header: header('status'), sortable: false },
      { type: 'date', key: 'updated', header: header('updated'), sortable: false, width: '120px' },
    ];
  });

  /** Phone 최근 활동: `app-list-card` instead of a table (Figma 237:1901). */
  readonly recentRecords = computed<readonly DataRecord[]>(() =>
    (this.snapshot()?.recentActivity ?? []).map(member => ({
      id: member.publicId,
      title: this.memberName(member),
      subtitle: this.translate.instant(this.roleLabelKey(member)),
      badge: {
        variant: this.statusVariant(member),
        label: this.translate.instant(`members.status.${member.memberStatus}`),
      },
      meta: this.shortDate(member.updatedAt),
    })),
  );

  /**
   * 빠른 기록 · 최근 방문: the 방문 기록 columns of `/quick-records`, read-only.
   * 수정 and 삭제 need the form there, so Home leaves the actions column out.
   */
  readonly quickColumns = computed<DataColumn[]>(() => {
    this.translate.currentLang();
    const header = (key: string) => this.translate.instant(`newcomers.visits.columns.${key}`) as string;
    return [
      { type: 'date', key: 'visitDate', header: header('visitDate'), sortable: false, width: '110px' },
      { type: 'avatar-name', key: 'name', header: header('name'), sortable: false, width: '150px' },
      { type: 'text', key: 'gender', header: header('gender'), sortable: false, width: '70px' },
      { type: 'text', key: 'birthYear', header: header('birthYear'), sortable: false, width: '90px' },
      { type: 'text', key: 'visitType', header: header('visitType'), sortable: false, width: '90px' },
      { type: 'text', key: 'source', header: header('source'), sortable: false, width: '120px' },
      { type: 'text', key: 'note', header: header('note'), sortable: false, tone: 'muted' },
    ];
  });

  readonly quickRows = computed<DataRecord[]>(() => {
    this.translate.currentLang();
    return this.quickVisits().map(v => ({
      id: v.publicId,
      title: v.fullName,
      cells: {
        visitDate: v.visitDate,
        gender: this.visitGender(v) ?? '—',
        birthYear: v.birthYear != null ? String(v.birthYear) : '—',
        visitType: this.translate.instant(`newcomers.visits.type.${v.visitType}`) as string,
        source: this.visitSource(v) ?? '—',
        note: v.note ?? '—',
      },
    }));
  });

  /** Phone: 성별 · 출생연도 · 경로 as subtitle, 구분 as badge, 방문일 as meta. */
  readonly quickRecords = computed<readonly DataRecord[]>(() => {
    this.translate.currentLang();
    return this.quickVisits().map(v => ({
      id: v.publicId,
      title: v.fullName,
      subtitle: [this.visitGender(v), v.birthYear, this.visitSource(v)].filter(part => part != null).join(' · '),
      badge: this.visitTypeBadge(v),
      meta: v.visitDate,
    }));
  });

  /** The 확인이 필요합니다 section disappears when neither card is granted. */
  readonly showsAttention = computed(
    () => this.showsBlock('pendingApprovals') || this.showsBlock('awaitingRsvps'),
  );

  ngOnInit(): void {
    this.home
      .loadSnapshot({
        pendingApprovals: this.showsBlock('pendingApprovals'),
        awaitingRsvps: this.showsBlock('awaitingRsvps'),
        overview: this.showsBlock('overview'),
        recentActivity: this.showsBlock('recentActivity'),
        upcomingEvents: this.showsBlock('upcomingEvents'),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: snapshot => {
          this.snapshot.set(snapshot);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

    if (this.showsBlock('groupAttendance')) {
      this.loadAttendance();
    } else {
      this.attendanceLoading.set(false);
    }

    if (this.showsBlock('sundayGroupCounts')) {
      this.loadSundayCounts();
    } else {
      this.sundayCountsLoading.set(false);
    }

    if (this.showsBlock('sundayCheckins')) {
      this.loadCheckins();
    } else {
      this.checkinsLoading.set(false);
    }

    if (this.showsBlock('quickRecords')) {
      this.loadQuickRecords();
    } else {
      this.quickLoading.set(false);
    }
  }

  showsBlock(id: HomeBlockId): boolean {
    return this.roles.showsHomeBlock(id);
  }

  onRangeChange(value: string): void {
    this.range.set(value as AttendanceRange);
    this.loadAttendance();
  }

  /** Figma 1218:121934: S→neutral, M→pending, L→active, XL→admin. */
  sizeVariant(sizeClass: GroupSizeClass): BadgeVariant {
    return SIZE_CLASS_VARIANTS[sizeClass];
  }

  /** `2026-10-11` → month and day for `home.sundayCounts.date`. */
  sundayDateParams(iso: string): { month: number; day: number } {
    return { month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)) };
  }

  /** `2026-09-18T…` → `2026.09.18`; the app registers no ko locale data. */
  shortDate(iso: string | null | undefined): string {
    return iso ? iso.slice(0, 10).replace(/-/g, '.') : '';
  }

  memberName(member: MemberSummary): string {
    return `${member.lastName}${member.firstName}`;
  }

  roleLabelKey(member: MemberSummary): string {
    return member.role === 'ADMIN' ? 'home.recent.roleAdmin' : 'home.recent.roleMember';
  }

  roleVariant(member: MemberSummary): BadgeVariant {
    return member.role === 'ADMIN' ? 'admin' : 'member';
  }

  statusVariant(member: MemberSummary): BadgeVariant {
    return resolveBadgeVariant(member.memberStatus.toLowerCase());
  }

  goToPendingMembers(): void {
    void this.router.navigate(['/members'], { queryParams: { status: 'PENDING' } });
  }

  goToRsvps(): void {
    void this.router.navigate(['/event-rsvps']);
  }

  goToMembers(): void {
    void this.router.navigate(['/members']);
  }

  goToMember(publicId: string): void {
    void this.router.navigate(['/members', publicId]);
  }

  goToQuickRecords(): void {
    void this.router.navigate(['/quick-records']);
  }

  quickPrev(): void {
    if (this.quickPage() === 0) return;
    this.quickPage.update(p => p - 1);
    this.loadQuickRecords();
  }

  quickNext(): void {
    if (this.quickPage() >= this.quickLastPage()) return;
    this.quickPage.update(p => p + 1);
    this.loadQuickRecords();
  }

  private loadQuickRecords(): void {
    this.quickLoading.set(true);
    this.quickFailed.set(false);
    this.home
      .loadQuickRecords(this.quickPage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.quickVisits.set(page.content);
          this.quickTotal.set(page.totalElements);
          this.quickLoading.set(false);
        },
        error: () => {
          this.quickVisits.set([]);
          this.quickFailed.set(true);
          this.quickLoading.set(false);
        },
      });
  }

  private visitGender(v: NewcomerVisit): string | null {
    return v.gender ? (this.translate.instant(`newcomers.gender.${v.gender}`) as string) : null;
  }

  private visitSource(v: NewcomerVisit): string | null {
    return v.source ? (this.translate.instant(`newcomers.visits.source.${v.source}`) as string) : null;
  }

  private visitTypeBadge(v: NewcomerVisit): DataRecordBadge {
    return {
      variant: v.visitType === 'FIRST' ? 'active' : 'pending',
      label: this.translate.instant(`newcomers.visits.type.${v.visitType}`) as string,
    };
  }

  private loadSundayCounts(): void {
    this.home
      .loadSundayGroupCounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: counts => {
          this.sundayCounts.set(counts);
          this.sundayCountsFailed.set(false);
          this.sundayCountsLoading.set(false);
        },
        error: () => {
          this.sundayCounts.set(null);
          this.sundayCountsFailed.set(true);
          this.sundayCountsLoading.set(false);
        },
      });
  }

  /**
   * Loads once on a weekday. On a Sunday it polls every 30 s while the screen
   * is open; a failed poll shows the error state but keeps polling.
   */
  private loadCheckins(): void {
    const ticks = this.checkinsLive ? timer(0, CHECKINS_POLL_MS) : of(0);
    ticks
      .pipe(
        switchMap(() =>
          this.home.loadSundayCheckins().pipe(
            map(checkins => ({ checkins, failed: false })),
            catchError(() => of({ checkins: null, failed: true })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ checkins, failed }) => {
        this.checkins.set(checkins);
        this.checkinsFailed.set(failed);
        if (!failed) {
          this.checkinsUpdatedAt.set(formatTime(new Date()));
        }
        this.checkinsLoading.set(false);
      });
  }

  private loadAttendance(): void {
    this.attendanceLoading.set(true);
    this.home
      .loadGroupAttendance(this.range())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: rows => {
          this.attendanceRows.set(rows);
          this.attendanceLoading.set(false);
        },
        error: () => {
          this.attendanceRows.set([]);
          this.attendanceLoading.set(false);
        },
      });
  }
}

const CHECKINS_POLL_MS = 30_000;

const SIZE_CLASS_VARIANTS: Readonly<Record<GroupSizeClass, BadgeVariant>> = {
  S: 'neutral',
  M: 'pending',
  L: 'active',
  XL: 'admin',
};

/** `2026년 9월 21일`. */
function formatToday(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** `10:42`. */
function formatTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
