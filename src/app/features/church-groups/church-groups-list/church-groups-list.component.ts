import {
  Component, inject, signal, computed, DestroyRef, OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef, ColGroupDef, GridApi, GridReadyEvent, GridOptions,
  ModuleRegistry, AllCommunityModule, themeQuartz,
} from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import {
  ChurchGroupsService,
  MemberCategory,
  CATEGORY_CONFIG,
  FILTER_CATEGORIES,
  MatrixRow,
  NEWCOMERS_KEY,
} from '../church-groups.service';
import { MemberSummary, ChurchGroupSummary } from '../../../core/models/member.model';
import { GroupMemberCellComponent } from './cells/group-member-cell.component';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-church-groups-list',
  standalone: true,
  imports: [AgGridAngular, ButtonModule],
  templateUrl: './church-groups-list.component.html',
})
export class ChurchGroupsListComponent implements OnInit {
  private readonly service = inject(ChurchGroupsService);
  private readonly destroyRef = inject(DestroyRef);
  private gridApi?: GridApi;

  readonly theme = themeQuartz.withParams({
    fontFamily: 'Manrope, sans-serif',
    fontSize: 11,
    headerFontWeight: 700,
    headerBackgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    cellHorizontalPadding: 0,
  });

  readonly loading = signal(true);
  readonly activeFilters = signal<Set<MemberCategory>>(new Set());

  private members = signal<MemberSummary[]>([]);
  private groups = signal<ChurchGroupSummary[]>([]);

  readonly rowData = computed<MatrixRow[]>(() =>
    this.service.buildMatrix(this.members(), this.groups()),
  );

  readonly columnDefs = computed<(ColDef | ColGroupDef)[]>(() =>
    this.buildColumnDefs(this.groups(), this.members()),
  );

  readonly filterCategories = FILTER_CATEGORIES;
  readonly categoryConfig = CATEGORY_CONFIG;

  readonly gridOptions: GridOptions = {
    rowHeight: 36,
    headerHeight: 32,
    groupHeaderHeight: 32,
    suppressMovableColumns: true,
    suppressCellFocus: true,
    domLayout: 'autoHeight',
    context: this.buildContext(),
  };

  ngOnInit(): void {
    this.service
      .loadDashboardData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ members, groups }) => {
          this.members.set(members);
          this.groups.set(groups);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  toggleFilter(category: MemberCategory): void {
    this.activeFilters.update(current => {
      const next = new Set(current);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
    this.gridApi?.updateGridOptions({ context: this.buildContext() });
    this.gridApi?.refreshCells({ force: true });
  }

  isFilterActive(category: MemberCategory): boolean {
    return this.activeFilters().has(category);
  }

  clearFilters(): void {
    this.activeFilters.set(new Set());
    this.gridApi?.updateGridOptions({ context: this.buildContext() });
    this.gridApi?.refreshCells({ force: true });
  }

  private buildContext() {
    return {
      activeFilters: () => this.activeFilters(),
      patchFlags: (publicId: string, patch: { isNextGroupLeader?: boolean; oneOnOneSignupFilled?: boolean }) => {
        this.service
          .patchMemberFlags(publicId, patch)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.members.update(list =>
                list.map(m =>
                  m.publicId === publicId ? { ...m, ...patch } : m,
                ),
              );
            },
            error: () => {
              this.gridApi?.refreshCells({ force: true });
            },
          });
      },
    };
  }

  private buildColumnDefs(groups: ChurchGroupSummary[], members: MemberSummary[]): (ColDef | ColGroupDef)[] {
    const leaderOf = (groupPublicId: string): string => {
      const m = members.find(m => m.groupPublicId === groupPublicId && m.churchRole === '순장');
      return m ? m.lastName + m.firstName : '';
    };

    const indexCol: ColGroupDef = {
      headerName: '',
      children: [{
        headerName: '순',
        children: [{
          headerName: '순장',
          width: 50,
          valueGetter: params => (params.node?.rowIndex ?? 0) + 1,
          cellStyle: { textAlign: 'center', fontSize: '11px' },
          sortable: false,
          filter: false,
          resizable: false,
        }],
      }],
    };

    const byDivision = new Map<string, ChurchGroupSummary[]>();
    for (const g of groups) {
      const div = g.division ?? '';
      if (!byDivision.has(div)) byDivision.set(div, []);
      byDivision.get(div)!.push(g);
    }

    const divisionCols: ColGroupDef[] = Array.from(byDivision.entries()).map(([div, divGroups]) => ({
      headerName: div,
      children: divGroups.map(g => ({
        headerName: g.name,
        children: [{
          headerName: leaderOf(g.publicId),
          field: `grp_${g.publicId}`,
          width: 100,
          cellRenderer: GroupMemberCellComponent,
          sortable: false,
          filter: false,
          resizable: false,
        }],
      })),
    }));

    const newcomersCol: ColGroupDef = {
      headerName: '새가족',
      children: [{
        headerName: '',
        field: NEWCOMERS_KEY,
        width: 80,
        cellRenderer: GroupMemberCellComponent,
        cellRendererParams: { centered: true },
        sortable: false,
        filter: false,
        resizable: false,
      }],
    };

    return [indexCol, ...divisionCols, newcomersCol];
  }
}
