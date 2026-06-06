import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { MemberService } from '../member.service';
import {
  MemberSummary,
  Baptism,
  BAPTISM_LABELS,
} from '../../../core/models/member.model';
import { MemberNameCellComponent } from './cells/member-name-cell.component';
import { BadgeCellComponent } from './cells/badge-cell.component';
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
    ConfirmDialogModule,
    ToastModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './members-list.component.html',
})
export class MembersListComponent implements OnInit {
  private readonly memberService  = inject(MemberService);
  private readonly router         = inject(Router);
  private readonly route          = inject(ActivatedRoute);
  private readonly confirmService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef     = inject(DestroyRef);

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

  private gridApi?: GridApi<MemberSummary>;
  private pendingStatusFilter = false;

  private readonly koCollator = new Intl.Collator('ko', { sensitivity: 'base' });

  private readonly actionsContext: MemberActionsContext = {
    onApprove: (member, event) => this.confirmApprove(member, event),
    onEdit:    (member, event) => this.goToEdit(member, event),
  };

  readonly columnDefs: ColDef<MemberSummary>[] = [
    {
      headerName: 'Name',
      colId: 'name',
      width: 220,
      minWidth: 220,
      valueGetter: p => `${p.data?.lastName ?? ''}${p.data?.firstName ?? ''}`,
      cellRenderer: MemberNameCellComponent,
      filter: 'agTextColumnFilter',
      sortable: true,
      comparator: (a: string, b: string) => this.koCollator.compare(a, b),
      sort: 'asc',
      getQuickFilterText: p => `${p.data?.lastName ?? ''}${p.data?.firstName ?? ''} ${p.data?.email ?? ''}`,
    },
    {
      headerName: 'Status',
      field: 'memberStatus',
      width: 120,
      cellRenderer: BadgeCellComponent,
      filter: 'agTextColumnFilter',
      sortable: true,
    },
    {
      headerName: 'Church Group',
      field: 'groupName',
      width: 160,
      valueFormatter: p => (p.value as string | null) ?? '—',
      filter: 'agTextColumnFilter',
      sortable: true,
      comparator: (a: string, b: string) => this.koCollator.compare(a ?? '', b ?? ''),
    },
    {
      headerName: 'Training',
      colId: 'training',
      width: 220,
      valueGetter: p => p.data?.trainings ?? [],
      cellRenderer: TrainingChipsCellComponent,
      sortable: false,
      filter: false,
    },
    {
      headerName: 'Ministry',
      colId: 'ministry',
      flex: 1,
      minWidth: 360,
      valueGetter: p => p.data?.activeMinistries ?? [],
      cellRenderer: MinistryChipsCellComponent,
      sortable: false,
      filter: false,
    },
    {
      headerName: 'Baptism',
      field: 'baptism',
      width: 140,
      valueFormatter: p => this.baptismLabel(p.value as Baptism | null | undefined),
      filter: 'agTextColumnFilter',
      filterValueGetter: p => this.baptismLabel(p.data?.baptism),
      sortable: true,
    },
    {
      headerName: 'Last Active',
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
      headerName: 'Approve',
      colId: 'approve',
      width: 120,
      cellRenderer: MemberActionsCellComponent,
      cellRendererParams: { action: 'approve' },
      sortable: false,
      filter: false,
    },
    {
      headerName: 'Edit',
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

    this.loadAll();
    this.memberService.refreshPendingCount();
  }

  onGridReady(event: GridReadyEvent<MemberSummary>): void {
    this.gridApi = event.api;
    if (this.pendingStatusFilter) this.applyPendingFilter();
  }

  private applyPendingFilter(): void {
    if (!this.gridApi) return;
    this.gridApi.setColumnFilterModel('memberStatus', {
      filterType: 'text',
      type: 'equals',
      filter: 'PENDING',
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
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not load members.' });
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

  confirmApprove(member: MemberSummary, event: Event): void {
    event.stopPropagation();
    this.confirmService.confirm({
      target: event.target as EventTarget,
      message: `Approve ${member.lastName}${member.firstName}?`,
      header: 'Approve Member',
      acceptIcon: 'pi pi-check-circle',
      acceptLabel: 'Approve',
      rejectLabel: 'Cancel',
      accept: () => this.approveMember(member),
    });
  }

  private approveMember(member: MemberSummary): void {
    this.memberService.approveMember(member.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Done', detail: 'Member approved.' });
          this.loadAll();
          this.memberService.refreshPendingCount();
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Approval failed.' });
        },
      });
  }

  baptismLabel(b?: Baptism | null): string {
    return b ? BAPTISM_LABELS[b] : '—';
  }
}
