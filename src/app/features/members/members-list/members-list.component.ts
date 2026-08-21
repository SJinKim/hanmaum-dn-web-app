import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
  RowClassParams,
  RowClickedEvent,
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
} from 'ag-grid-community';

import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';

import { MemberService } from '../member.service';
import {
  MemberSummary,
  Baptism,
  MemberStatus,
} from '../../../core/models/member.model';
import { MemberNameCellComponent } from './cells/member-name-cell.component';
import { BadgeCellComponent } from './cells/badge-cell.component';
import { SetFilterComponent, NULL_TOKEN } from './filters/set-filter.component';
import { NameFilterComponent } from './filters/name-filter.component';
import { TrainingFilterComponent } from './filters/training-filter.component';
import { TrainingChipsCellComponent } from './cells/training-chips-cell.component';
import { MinistryChipsCellComponent } from './cells/ministry-chips-cell.component';
import {
  MemberActionsCellComponent,
  MemberActionsContext,
} from './cells/member-actions-cell.component';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-members-list',
  standalone: true,
  imports: [
    FormsModule,
    AgGridAngular,
    ButtonModule,
    ToastModule,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './members-list.component.html',
})
export class MembersListComponent implements OnInit {
  private readonly memberService  = inject(MemberService);
  private readonly router         = inject(Router);
  private readonly route          = inject(ActivatedRoute);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef     = inject(DestroyRef);
  private readonly translate      = inject(TranslateService);

  /** Shorthand for a synchronous translation lookup (used in AG-Grid colDefs + toasts). */
  private t = (key: string): string => this.translate.instant(key);

  theme = themeQuartz.withParams({
    fontFamily: 'Manrope, sans-serif',
    fontSize: 12,
    headerFontWeight: 700,
    headerBackgroundColor: '#ffffff',
    headerTextColor: '#1f2937',
    backgroundColor: '#ffffff',
    foregroundColor: '#1f2937',
    rowHoverColor: '#f9fafb',
    borderColor: '#f3f4f6',
    cellHorizontalPadding: 16,
    wrapperBorderRadius: 0,
    wrapperBorder: false,
  });
  members      = signal<MemberSummary[]>([]);
  pendingCount = this.memberService.pendingCount;
  loading      = signal(false);
  searchTerm   = '';

  /** Filter option sources — loaded from their backing tables, not the grid rows. */
  private readonly churchGroupNames = signal<string[]>([]);
  private readonly ministryTitles   = signal<string[]>([]);

  private gridApi?: GridApi<MemberSummary>;
  private pendingStatusFilter = false;

  private readonly koCollator = new Intl.Collator('ko', { sensitivity: 'base' });

  private readonly actionsContext: MemberActionsContext = {
    churchGroups: [],
    onApprove: (member, groupPublicId) => this.approveMember(member, groupPublicId),
    onEdit:    (member, event) => this.goToEdit(member, event),
    onGroupsMissing: () => this.messageService.add({
      severity: 'error',
      summary: this.t('members.toast.error'),
      detail: this.t('members.toast.groupsLoadFailed'),
    }),
  };

  readonly columnDefs: ColDef<MemberSummary>[] = [
    {
      headerValueGetter: () => this.t('members.columns.name'),
      colId: 'name',
      width: 200,
      minWidth: 200,
      valueGetter: p => `${p.data?.lastName ?? ''}${p.data?.firstName ?? ''}`,
      cellRenderer: MemberNameCellComponent,
      filter: NameFilterComponent,
      sortable: true,
      comparator: (a: string, b: string) => this.koCollator.compare(a, b),
      sort: 'asc',
      getQuickFilterText: p => `${p.data?.lastName ?? ''}${p.data?.firstName ?? ''} ${p.data?.email ?? ''}`,
    },
    {
      headerValueGetter: () => this.t('members.columns.status'),
      field: 'memberStatus',
      width: 120,
      cellRenderer: BadgeCellComponent,
      filter: SetFilterComponent,
      filterParams: {
        options: () => (['PENDING', 'ACTIVE', 'INACTIVE', 'DELETED'] as MemberStatus[])
          .map(s => ({ token: s, label: this.t(`members.status.${s}`) })),
        optionValues: (d: MemberSummary) => [d?.memberStatus],
      },
      sortable: true,
    },
    {
      headerValueGetter: () => this.t('members.columns.group'),
      field: 'groupName',
      width: 150,
      valueFormatter: p => (p.value as string | null) ?? '—',
      filter: SetFilterComponent,
      filterParams: {
        // All groups from the church-groups table — not just those present in the rows.
        options: () => this.churchGroupNames().map(n => ({ token: n, label: n })),
        optionValues: (d: MemberSummary) => [d?.groupName],
      },
      sortable: true,
      comparator: (a: string, b: string) => this.koCollator.compare(a ?? '', b ?? ''),
    },
    {
      headerValueGetter: () => this.t('members.columns.training'),
      colId: 'training',
      width: 200,
      valueGetter: p => p.data?.trainings ?? [],
      cellRenderer: TrainingChipsCellComponent,
      sortable: false,
      filter: TrainingFilterComponent,
    },
    {
      headerValueGetter: () => this.t('members.columns.ministry'),
      colId: 'ministry',
      minWidth: 240,
      valueGetter: p => p.data?.activeMinistries ?? [],
      cellRenderer: MinistryChipsCellComponent,
      sortable: false,
      filter: SetFilterComponent,
      filterParams: {
        // All active ministries from the ministries table, plus a "(없음)" bucket.
        options: () => [
          ...this.ministryTitles().map(t => ({ token: t, label: t })),
          { token: NULL_TOKEN, label: this.t('common.none') },
        ],
        optionValues: (d: MemberSummary) => d?.activeMinistries ?? [],
      },
    },
    {
      headerValueGetter: () => this.t('members.columns.baptism'),
      field: 'baptism',
      width: 120,
      valueFormatter: p => this.baptismLabel(p.value as Baptism | null | undefined),
      filter: SetFilterComponent,
      filterParams: {
        // Fixed enum order: Unbaptized, Infant, General, Confirmation, then (없음) last.
        options: () => [
          ...(['UNBAPTIZED', 'INFANT_BAPTIZED', 'GENERAL_BAPTIZED', 'CONFIRMATION'] as Baptism[])
            .map(b => ({ token: b, label: this.t(`members.baptism.${b}`) })),
          { token: NULL_TOKEN, label: this.t('common.none') },
        ],
        optionValues: (d: MemberSummary) => [d?.baptism],
      },
      sortable: true,
    },
    {
      headerValueGetter: () => this.t('members.columns.updatedAt'),
      field: 'updatedAt',
      width: 140,
      filter: 'agDateColumnFilter',
      sortable: true,
      valueFormatter: p => (p.value ? new Date(p.value).toISOString().slice(0, 10) : '—'),
      filterParams: {
        comparator: (filterDate: Date, cellValue: string | undefined) => {
          if (!cellValue) return -1;
          const cell = new Date(cellValue);
          const cellDay = new Date(cell.getFullYear(), cell.getMonth(), cell.getDate()).getTime();
          const filterDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate()).getTime();
          if (cellDay < filterDay) return -1;
          if (cellDay > filterDay) return 1;
          return 0;
        },
      },
    },
    {
      headerValueGetter: () => this.t('members.columns.approve'),
      colId: 'approve',
      width: 120,
      cellRenderer: MemberActionsCellComponent,
      cellRendererParams: { action: 'approve' },
      sortable: false,
      filter: false,
    },
    {
      headerValueGetter: () => this.t('members.columns.edit'),
      colId: 'edit',
      width: 80,
      cellRenderer: MemberActionsCellComponent,
      cellRendererParams: { action: 'edit' },
      sortable: false,
      filter: false,
    },
  ];

  readonly defaultColDef: ColDef = {
    resizable: true,
  };

  readonly gridOptions: GridOptions<MemberSummary> = {
    rowHeight: 56,
    headerHeight: 40,
    pagination: true,
    paginationPageSize: 20,
    paginationPageSizeSelector: [20, 50, 100],
    context: this.actionsContext,
    getRowClass: (params: RowClassParams<MemberSummary>) =>
      params.data?.memberStatus === 'PENDING' ? 'row-pending' : '',
  };

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        if (params.get('status') === 'PENDING') {
          this.pendingStatusFilter = true;
          this.applyPendingFilter();
        }
      });

    // Re-render AG-Grid headers + cells when the language changes (headerValueGetter,
    // valueFormatter and filter option labels all read the active language via `t`).
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.gridApi?.refreshHeader();
        this.gridApi?.refreshCells({ force: true });
      });

    this.loadAll();
    this.memberService.refreshPendingCount();
    this.memberService.getChurchGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: groups => {
          this.actionsContext.churchGroups = groups;
          this.churchGroupNames.set(groups.map(g => g.name));
        },
        error: () => { this.actionsContext.churchGroups = []; },
      });
    this.memberService.getMinistryCatalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ministries => { this.ministryTitles.set(ministries.map(m => m.title)); },
        error: () => { this.ministryTitles.set([]); },
      });
  }

  onGridReady(event: GridReadyEvent<MemberSummary>): void {
    this.gridApi = event.api;
    if (this.pendingStatusFilter) this.applyPendingFilter();
  }

  private applyPendingFilter(): void {
    if (!this.gridApi) return;
    this.gridApi.setColumnFilterModel('memberStatus', {
      values: ['PENDING'],
    }).then(() => this.gridApi?.onFilterChanged());
  }

  private loadAll(): void {
    this.loading.set(true);
    this.memberService.getMembers({ page: 0, size: 1000 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.members.set(res.content);
          this.loading.set(false);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: this.t('members.toast.error'),
            detail: this.t('members.toast.membersLoadFailed'),
          });
          this.loading.set(false);
        },
      });
  }

  onSearch(term: string): void { this.searchTerm = term; }

  onRowClicked(event: RowClickedEvent<MemberSummary>): void {
    if (event.data) this.goToDetail(event.data);
  }

  goToDetail(member: MemberSummary): void {
    this.router.navigate(['/members', member.publicId]);
  }

  goToEdit(member: MemberSummary, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/members', member.publicId, 'edit']);
  }

  goToCreate(): void { this.router.navigate(['/members', 'new']); }

  /** Rejects on failure so the approve cell can stop its spinner. */
  private async approveMember(member: MemberSummary, groupPublicId: string): Promise<void> {
    try {
      await firstValueFrom(this.memberService.approveMember(member.publicId, groupPublicId));
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: this.t('members.toast.error'),
        detail: this.t('members.toast.approveFailed'),
      });
      throw err;
    }
    this.messageService.add({
      severity: 'success',
      summary: this.t('members.toast.done'),
      detail: this.t('members.toast.approveSuccess'),
    });
    this.loadAll();
    this.memberService.refreshPendingCount();
  }

  baptismLabel(b?: Baptism | null): string {
    return b ? this.t(`members.baptism.${b}`) : '—';
  }
}
