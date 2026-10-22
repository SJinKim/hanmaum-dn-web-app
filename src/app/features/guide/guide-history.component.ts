import { Component, DestroyRef, HostListener, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { RoleService } from '../../core/services/role.service';
import { EmptyStateComponent } from '../../core/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header.component';
import { SkeletonComponent } from '../../core/ui/skeleton/skeleton.component';
import { StatCardComponent } from '../../core/ui/stat-card/stat-card.component';
import { GuideHistoryService } from './guide-history.service';
import { GuideReport } from './guide-report.model';

@Component({
  selector: 'app-guide-history', standalone: true,
  imports: [RouterLink, FormsModule, TranslatePipe, ButtonModule, ConfirmDialogModule, PaginatorModule, SelectModule, TableModule, TooltipModule,
    EmptyStateComponent, PageHeaderComponent, SkeletonComponent, StatCardComponent],
  host: { class: 'block min-w-0' }, templateUrl: './guide-history.component.html',
})
export class GuideHistoryComponent {
  readonly state = inject(GuideHistoryService);
  private readonly roles = inject(RoleService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly destroy = inject(DestroyRef);
  readonly canWrite = computed(() => this.roles.canWrite('guide'));
  readonly services = [1, 2, 3] as const;
  private confirming = false;

  constructor() { this.state.load(); }
  date(value: string): string { return value.replaceAll('-', '.'); }
  count(value: number | null): string { return value === null ? this.translate.instant('guide.reports.unknown') : value.toLocaleString('en-US'); }
  people(value: number | null): string { return value === null ? this.count(value) : this.translate.instant('guide.reports.people', { count: this.count(value) }); }
  delta(value: number | null): string { return value === null ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('en-US')}`; }
  serviceCount(report: GuideReport, service: 1 | 2 | 3): number | null { return report[`service${service}Count`]; }
  serviceDelta(report: GuideReport, service: 1 | 2 | 3): number | null {
    const previous = this.state.previous(), now = this.serviceCount(report, service);
    const before = previous ? this.serviceCount(previous, service) : null;
    return now === null || before === null ? null : now - before;
  }
  changePage(event: PaginatorState): void {
    if (!this.state.deleting()) this.state.load({ page: event.page ?? 0, size: event.rows ?? this.state.query().size });
  }
  changeYear(year: number): void { if (!this.state.deleting()) this.state.load({ year, page: 0 }); }
  confirmDelete(report: GuideReport): void {
    if (!this.canWrite() || this.state.deleting() || this.state.loading() || this.state.loadFailed() || this.confirming) return;
    this.confirming = true;
    this.confirmation.confirm({ key: 'guide-delete', header: this.translate.instant('guide.reports.deleteTitle'),
      message: this.translate.instant('guide.reports.deleteMessage', { date: this.date(report.serviceDate) }),
      icon: 'pi pi-exclamation-triangle', acceptLabel: this.translate.instant('guide.reports.delete'),
      rejectLabel: this.translate.instant('guide.reports.cancel'), acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.confirming = false; this.state.remove(report).pipe(takeUntilDestroyed(this.destroy)).subscribe({ error: () => { /* State displays failure. */ } }); },
      reject: () => { this.confirming = false; },
    });
  }
  canLeave(): boolean {
    if (!this.state.deleting()) return true;
    this.state.notice.set('waitForDelete'); return false;
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.state.deleting()) { event.preventDefault(); event.returnValue = ''; }
  }
}
