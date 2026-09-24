import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MemberSummary } from '../../core/models/member.model';
import { HomeBlockId } from '../../core/navigation/home-blocks';
import { RoleService } from '../../core/services/role.service';
import { BadgeComponent } from '../../core/ui/badge/badge.component';
import { BreakpointService } from '../../core/ui/breakpoint.service';
import { DataColumn, DataRecord } from '../../core/ui/data-record.model';
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
  GroupAttendanceRow,
  HomeSnapshot,
  totalAttendanceRow,
} from './home.model';
import { HomeService } from './home.service';

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

  readonly isPhone = this.breakpoints.isPhone;

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

  /** The 확인이 필요합니다 section disappears when neither card is granted. */
  readonly showsAttention = computed(
    () => this.showsBlock('pendingApprovals') || this.showsBlock('awaitingRsvps'),
  );

  ngOnInit(): void {
    this.home
      .loadSnapshot()
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
  }

  showsBlock(id: HomeBlockId): boolean {
    return this.roles.showsHomeBlock(id);
  }

  onRangeChange(value: string): void {
    this.range.set(value as AttendanceRange);
    this.loadAttendance();
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

/** `2026년 9월 21일`. */
function formatToday(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}
