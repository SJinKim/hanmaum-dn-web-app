import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { Subject, debounceTime } from 'rxjs';
import {
  NEWCOMER_IDENTITY_STATUSES,
  NewcomerIdentityStatus,
  NewcomerOption,
  NewcomerSortProperty,
  Newcomer,
  POST_ASSIGNMENT_ATTENDANCES,
  PostAssignmentAttendance,
} from '../../../core/models/newcomer.model';
import { RoleService } from '../../../core/services/role.service';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { DataColumn, DataRecord } from '../../../core/ui/data-record.model';
import { DataTableComponent, DataTableSort } from '../../../core/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { FilterSelectComponent } from '../../../core/ui/filter-select/filter-select.component';
import { ListCardComponent } from '../../../core/ui/list-card/list-card.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../../core/ui/search-field/search-field.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { ToolbarComponent } from '../../../core/ui/toolbar/toolbar.component';
import { BadgeVariant } from '../../../core/ui/variant-tokens';
import { NewcomerService } from '../newcomer.service';

/** Milliseconds a keystroke waits before it becomes a request. */
const SEARCH_DEBOUNCE_MS = 300;

/** 출석현황 badge colour: 정착 green, 불규칙 amber, 이탈 red, the rest neutral. */
export const ATTENDANCE_VARIANT: Readonly<Record<PostAssignmentAttendance, BadgeVariant>> = {
  REGULAR: 'active',
  OCCASIONAL: 'pending',
  WORSHIP_ONLY: 'pending',
  ABSENT_OVER_MONTH: 'rejected',
  CHANGED_CHURCH: 'neutral',
  RETURNED_OR_MOVED: 'neutral',
};

/**
 * Figma: 새가족 / Desktop 318:20606. Below 834px the table becomes a list of
 * `app-list-card`, like 청년. Filter, page and result live in
 * {@link NewcomerService}; every filter is a query parameter of
 * `GET /newcomers`, nothing is filtered or sorted in the client.
 *
 * Deviations from Figma, all contract gaps (commented on #41):
 * - no 등반차수 chip — `GET /newcomers` has no `intakeRound` filter;
 * - only 등록일 and 이름 sort — the server sorts by nothing else.
 */
@Component({
  selector: 'app-newcomers-list',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    PageHeaderComponent,
    ToolbarComponent,
    SearchFieldComponent,
    FilterSelectComponent,
    DataTableComponent,
    ListCardComponent,
    EmptyStateComponent,
    SkeletonComponent,
  ],
  host: { class: 'flex h-full flex-col' },
  templateUrl: './newcomers-list.component.html',
})
export class NewcomersListComponent implements OnInit {
  private readonly newcomerService = inject(NewcomerService);
  private readonly roles = inject(RoleService);
  private readonly breakpoints = inject(BreakpointService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly newcomers = this.newcomerService.newcomers;
  readonly total = this.newcomerService.total;
  readonly loading = this.newcomerService.listLoading;
  readonly failed = this.newcomerService.listFailed;
  readonly page = this.newcomerService.page;
  readonly size = this.newcomerService.size;
  readonly attendance = this.newcomerService.attendance;
  readonly caregiver = this.newcomerService.caregiver;
  readonly identity = this.newcomerService.identity;
  readonly sort = this.newcomerService.sort;

  readonly subtitleParams = computed(() => ({
    inCare: this.newcomerService.inCareCount(),
    graduated: this.newcomerService.graduatedCount(),
    newThisWeek: this.newcomerService.newThisWeekCount(),
  }));

  readonly isPhone = this.breakpoints.isPhone;
  readonly filtersOpen = signal(false);

  readonly searchText = signal(this.newcomerService.search());
  private readonly searchInput$ = new Subject<string>();

  /** Caregivers from `GET /newcomers/options`; empty until the request lands. */
  private readonly caregivers = signal<readonly NewcomerOption[]>([]);

  readonly attendanceOptions = computed(() => {
    this.translate.currentLang();
    return [
      { label: this.translate.instant('newcomers.filters.attendanceAll'), value: null },
      ...POST_ASSIGNMENT_ATTENDANCES.map(value => ({
        label: this.translate.instant(`newcomers.attendance.${value}`),
        value: value as PostAssignmentAttendance | null,
      })),
    ];
  });

  readonly caregiverOptions = computed(() => {
    this.translate.currentLang();
    return [
      { label: this.translate.instant('newcomers.filters.caregiverAll'), value: null as string | null },
      ...this.caregivers().map(c => ({ label: c.label, value: c.publicId as string | null })),
    ];
  });

  readonly identityOptions = computed(() => {
    this.translate.currentLang();
    return [
      { label: this.translate.instant('newcomers.filters.identityAll'), value: null },
      ...NEWCOMER_IDENTITY_STATUSES.map(value => ({
        label: this.translate.instant(`newcomers.identity.${value}`),
        value: value as NewcomerIdentityStatus | null,
      })),
    ];
  });

  readonly filtered = computed(
    () =>
      !!this.newcomerService.search() || !!this.attendance() || !!this.caregiver() || !!this.identity(),
  );

  /** Phone: 이름, 담당자 · 순 as subtitle, 출석현황 as badge, 등록일 as meta. */
  readonly records = computed<readonly DataRecord[]>(() => {
    this.translate.currentLang();
    return this.newcomers().map(n => ({
      id: n.publicId,
      title: this.fullName(n),
      subtitle: `${n.caregiver?.label ?? '—'} · ${n.assignedGroup?.label ?? this.translate.instant('newcomers.unassigned')}`,
      badge: this.attendanceBadge(n),
      meta: this.shortDate(n.registrationDate),
    }));
  });

  readonly tableRows = computed<DataRecord[]>(() => {
    this.translate.currentLang();
    return this.newcomers().map(n => ({
      id: n.publicId,
      title: this.fullName(n),
      cells: {
        registrationDate: this.shortDate(n.registrationDate),
        gender: n.gender ? this.translate.instant(`newcomers.gender.${n.gender}`) : '—',
        caregiver: n.caregiver?.label ?? '—',
        group: n.assignedGroup?.label ?? this.translate.instant('newcomers.unassigned'),
        attendance: this.attendanceBadge(n),
        intakeRound: this.intakeRoundLabel(n),
        birthDate: this.shortDate(n.birthDate),
        baptism: n.baptism ? this.translate.instant(`members.baptism.${n.baptism}`) : '—',
        identity: n.identityStatus ? this.translate.instant(`newcomers.identity.${n.identityStatus}`) : '—',
        workOrSchool: n.workOrSchool ?? '—',
      },
    }));
  });

  /** Figma column order; only 등록일 and 이름 carry a `sortKey`, the server's sort property. */
  readonly columns = computed<DataColumn[]>(() => {
    this.translate.currentLang();
    const header = (key: string) => this.translate.instant(`newcomers.columns.${key}`);
    return [
      { type: 'date', key: 'registrationDate', header: header('registrationDate'), sortKey: 'registrationDate', width: '120px' },
      { type: 'avatar-name', key: 'name', header: header('name'), sortKey: 'name', width: '160px' },
      { type: 'text', key: 'gender', header: header('gender'), sortable: false, width: '80px' },
      { type: 'text', key: 'caregiver', header: header('caregiver'), sortable: false, width: '120px' },
      { type: 'text', key: 'group', header: header('group'), sortable: false, width: '120px' },
      { type: 'badge', key: 'attendance', header: header('attendance'), sortable: false, width: '140px' },
      { type: 'text', key: 'intakeRound', header: header('intakeRound'), sortable: false, width: '100px' },
      { type: 'date', key: 'birthDate', header: header('birthDate'), sortable: false, width: '120px' },
      { type: 'text', key: 'baptism', header: header('baptism'), sortable: false, width: '100px' },
      { type: 'text', key: 'identity', header: header('identity'), sortable: false, width: '120px' },
      { type: 'text', key: 'workOrSchool', header: header('workOrSchool'), sortable: false, width: '160px' },
    ];
  });

  readonly tableSort = computed<DataTableSort | null>(() => {
    const sort = this.sort();
    return { field: sort.property, direction: sort.direction };
  });

  readonly rangeParams = computed(() => {
    const total = this.total();
    const first = total === 0 ? 0 : this.page() * this.size() + 1;
    return { from: first, to: Math.min((this.page() + 1) * this.size(), total), total };
  });

  readonly canWrite = computed(() => this.roles.canWrite('newcomers'));
  readonly hasPages = computed(() => this.total() > this.size());
  readonly lastPage = computed(() => Math.max(0, Math.ceil(this.total() / this.size()) - 1));

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => this.newcomerService.setSearch(term));

    this.newcomerService.loadNewcomers();
    this.newcomerService.refreshCounts();

    this.newcomerService
      .getOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: options => this.caregivers.set(options.caregivers),
        error: () => this.caregivers.set([]),
      });
  }

  onSearchChange(term: string): void {
    this.searchText.set(term);
    this.searchInput$.next(term);
  }

  onSearchCleared(): void {
    this.searchText.set('');
    this.newcomerService.setSearch('');
  }

  onAttendanceChange(value: PostAssignmentAttendance | null): void {
    this.newcomerService.setAttendance(value);
  }

  onCaregiverChange(value: string | null): void {
    this.newcomerService.setCaregiver(value);
  }

  onIdentityChange(value: NewcomerIdentityStatus | null): void {
    this.newcomerService.setIdentity(value);
  }

  /** `property` is a column's `sortKey`, so always a {@link NewcomerSortProperty}. */
  onSort(property: string): void {
    this.newcomerService.toggleSort(property as NewcomerSortProperty);
  }

  toggleFilters(): void {
    this.filtersOpen.update(open => !open);
  }

  resetFilters(): void {
    this.searchText.set('');
    this.newcomerService.resetFilters();
  }

  retry(): void {
    this.newcomerService.loadNewcomers();
  }

  prevPage(): void {
    this.newcomerService.setPage(this.page() - 1);
  }

  nextPage(): void {
    if (this.page() >= this.lastPage()) return;
    this.newcomerService.setPage(this.page() + 1);
  }

  goToDetail(publicId: string): void {
    void this.router.navigate(['/newcomers', publicId]);
  }

  goToCreate(): void {
    void this.router.navigate(['/newcomers', 'new']);
  }

  goToVisits(): void {
    void this.router.navigate(['/quick-records']);
  }

  goToQrLinks(): void {
    void this.router.navigate(['/newcomers', 'qr-links']);
  }

  private fullName(n: Newcomer): string {
    return `${n.lastName}${n.firstName}`;
  }

  private attendanceBadge(n: Newcomer): { variant: BadgeVariant; label: string } | undefined {
    if (!n.postAssignmentAttendance) return undefined;
    return {
      variant: ATTENDANCE_VARIANT[n.postAssignmentAttendance],
      label: this.translate.instant(`newcomers.attendance.${n.postAssignmentAttendance}`),
    };
  }

  /** 등반차수 shows the intake round until the response carries the cohort (contract gap). */
  private intakeRoundLabel(n: Newcomer): string {
    return n.intakeRound != null
      ? this.translate.instant('newcomers.intakeRound', { n: n.intakeRound })
      : '—';
  }

  private shortDate(iso: string | null | undefined): string {
    return iso ? iso.slice(0, 10) : '—';
  }
}
