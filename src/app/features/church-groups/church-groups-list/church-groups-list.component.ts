import {
  Component, inject, signal, computed, DestroyRef, OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChurchGroupsService,
  CATEGORY_CONFIG,
  FILTER_CATEGORIES,
  ChurchGroupMatrix,
  MemberCategory,
} from '../church-groups.service';
import { MemberSummary, ChurchGroupSummary } from '../../../core/models/member.model';

@Component({
  selector: 'app-church-groups-list',
  standalone: true,
  imports: [],
  templateUrl: './church-groups-list.component.html',
  styles: [`
    .cg-table { border-collapse: collapse; font-size: 14px; table-layout: fixed; width: 100%; }
    .cg-table th, .cg-table td {
      border: 1px solid #e5e7eb;
      padding: 5px 8px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cg-table th { background: #f9fafb; font-weight: 700; }
    .cg-corner { background: #fff; }
    .cg-group, .cg-leader, .cg-cell, .cg-newcomers-head { width: 6%; }
    .cg-idx-label, .cg-idx-cell { width: 2.5%; }
    .cg-cell { text-align: left; height: 34px; }
    .cg-center { text-align: center; }
    .cg-empty { background: #fafafa; }
    .cg-table thead tr:nth-child(2) th { border-bottom: 2px solid #9ca3af; }
    .cg-table thead tr:last-child th { border-bottom: 2px solid #9ca3af; }
    .cg-table .cg-newcomers-head { border-bottom: 2px solid #9ca3af; }
    .cg-table .cg-div-end { border-right: 2px solid #000; }
  `],
})
export class ChurchGroupsListComponent implements OnInit {
  private readonly service = inject(ChurchGroupsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly newcomersLeader = signal('');

  private members = signal<MemberSummary[]>([]);
  private groups = signal<ChurchGroupSummary[]>([]);

  readonly matrix = computed<ChurchGroupMatrix>(() =>
    this.service.buildMatrix(this.members(), this.groups(), this.newcomersLeader()),
  );

  readonly rowIndices = computed<number[]>(() =>
    Array.from({ length: this.matrix().rowCount }, (_, i) => i),
  );

  readonly filterCategories = FILTER_CATEGORIES;
  readonly categoryConfig = CATEGORY_CONFIG;

  readonly activeCategories = signal<ReadonlySet<MemberCategory>>(new Set());

  toggleCategory(cat: MemberCategory): void {
    this.activeCategories.update(current => {
      const next = new Set(current);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  isDimmed(cat: MemberCategory): boolean {
    const active = this.activeCategories();
    return active.size > 0 && !active.has(cat);
  }

  ngOnInit(): void {
    this.service
      .loadDashboardData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ members, groups, newcomersLeader }) => {
          this.members.set(members);
          this.groups.set(groups);
          this.newcomersLeader.set(newcomersLeader);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
