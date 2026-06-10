import {
  Component, inject, signal, computed, DestroyRef, OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChurchGroupsService,
  CATEGORY_CONFIG,
  FILTER_CATEGORIES,
  ChurchGroupMatrix,
} from '../church-groups.service';
import { MemberSummary, ChurchGroupSummary } from '../../../core/models/member.model';

@Component({
  selector: 'app-church-groups-list',
  standalone: true,
  imports: [],
  templateUrl: './church-groups-list.component.html',
  styles: [`
    .cg-table { border-collapse: collapse; font-size: 11px; table-layout: fixed; }
    .cg-table th, .cg-table td {
      border: 1px solid #e5e7eb;
      padding: 2px 6px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cg-table th { background: #f9fafb; font-weight: 700; }
    .cg-corner { background: #fff; }
    .cg-group, .cg-leader, .cg-cell, .cg-newcomers-head { width: 90px; }
    .cg-idx-label, .cg-idx-cell { width: 36px; }
    .cg-cell { text-align: left; height: 24px; }
    .cg-center { text-align: center; }
    .cg-empty { background: #fafafa; }
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
    this.service.buildMatrix(this.members(), this.groups()),
  );

  readonly rowIndices = computed<number[]>(() =>
    Array.from({ length: this.matrix().rowCount }, (_, i) => i),
  );

  readonly filterCategories = FILTER_CATEGORIES;
  readonly categoryConfig = CATEGORY_CONFIG;

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
