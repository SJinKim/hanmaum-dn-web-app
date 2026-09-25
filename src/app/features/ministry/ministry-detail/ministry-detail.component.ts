import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Menu, MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';

import { injectAppLang } from '../../../core/i18n/language';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { DataCellDirective } from '../../../core/ui/data-table/data-cell.directive';
import { DataTableComponent } from '../../../core/ui/data-table/data-table.component';
import { DataColumn, DataRecord } from '../../../core/ui/data-record.model';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { ListCardComponent } from '../../../core/ui/list-card/list-card.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { MinistryService } from '../ministry.service';
import { ActiveMinistryMemberDto, Ministry, MinistryAssignmentRole } from '../ministry.model';
import { localDateToIso } from '../../../core/models/member-activity.model';
import { MinistryAssignmentService } from '../ministry-assignment.service';
import { MinistryAddMemberDialogComponent } from './ministry-add-member-dialog.component';
import { MinistryMemberEditDialogComponent } from './ministry-member-edit-dialog.component';

/**
 * Figma: 사역 상세 · Desktop (204:6930). A header, a card 팀원 and below it a
 * read-only card 팀원 히스토리 with every assignment, current and ended; the
 * tables become `app-list-card`s on Phone.
 *
 * 관리 edits or ends an assignment through the member's list (see
 * MinistryAssignmentService); Phone has no 관리 yet. 메모 is cut to one line
 * in both tables, the full text is the cell's tooltip.
 */
@Component({
  selector: 'app-ministry-detail',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    ConfirmDialogModule,
    MenuModule,
    ToastModule,
    TooltipModule,
    DataCellDirective,
    DataTableComponent,
    EmptyStateComponent,
    ListCardComponent,
    PageHeaderComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    MinistryAddMemberDialogComponent,
    MinistryMemberEditDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './ministry-detail.component.html',
})
export class MinistryDetailComponent implements OnInit {
  private readonly ministryService = inject(MinistryService);
  private readonly assignments     = inject(MinistryAssignmentService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly translate       = inject(TranslateService);
  private readonly confirmService  = inject(ConfirmationService);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);
  private readonly lang            = injectAppLang();

  readonly isPhone = inject(BreakpointService).isPhone;

  readonly ministry         = signal<Ministry | null>(null);
  readonly activeMembers    = signal<ActiveMinistryMemberDto[]>([]);
  readonly loading          = signal(true);
  readonly membersLoading   = signal(true);
  readonly history          = signal<ActiveMinistryMemberDto[]>([]);
  readonly historyLoading   = signal(true);
  readonly addDialogVisible = signal(false);
  readonly editDialogVisible = signal(false);
  readonly editingMember    = signal<ActiveMinistryMemberDto | null>(null);

  private readonly moreMenu = viewChild<Menu>('moreMenu');
  private readonly publicId = this.route.snapshot.paramMap.get('publicId')!;

  readonly breadcrumb = computed(() => {
    this.lang();
    return [this.translate.instant('ministry.title') as string, this.ministry()?.title ?? ''];
  });

  /** "{subtitle} · 팀원 N명", leaving out an empty subtitle. */
  readonly subtitle = computed(() => {
    this.lang();
    const m = this.ministry();
    if (!m) return '';
    const count = this.translate.instant('ministry.memberCount', { count: this.activeMembers().length }) as string;
    return [m.subtitle, count].filter(Boolean).join(' · ');
  });

  readonly columns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`ministry.detail.columns.${key}`) as string;
    return [
      { type: 'avatar-name', header: t('name') },
      { type: 'text', header: t('role') },
      { type: 'badge', header: t('status') },
      { type: 'date', header: t('startDate') },
      { type: 'custom', key: 'note', header: t('note'), sortKey: 'cells.note' },
      { type: 'actions', header: t('actions') },
    ];
  });

  readonly records = computed<DataRecord[]>(() => {
    this.lang();
    const active = this.translate.instant('ministry.detail.statusActive') as string;
    return this.activeMembers().map(m => ({
      id: m.publicId,
      title: m.fullName,
      subtitle: this.roleLabel(m.role),
      badge: { variant: 'active', label: active },
      meta: this.formatStartDate(m.startDate),
      cells: { note: m.note ?? '' },
    }));
  });

  /** 팀원 히스토리: no 상태 and no 관리 — a history is not edited. */
  readonly historyColumns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`ministry.detail.columns.${key}`) as string;
    return [
      { type: 'avatar-name', header: t('name') },
      { type: 'text', header: t('role') },
      { type: 'date', header: t('startDate') },
      { type: 'date', key: 'endDate', header: t('endDate') },
      { type: 'custom', key: 'note', header: t('note'), sortKey: 'cells.note' },
    ];
  });

  /**
   * One row per assignment. A member who left and came back has two, so the id
   * is the assignment (member + 시작일), not the member.
   */
  readonly historyRecords = computed<DataRecord[]>(() => {
    this.lang();
    return this.history().map(m => ({
      id: historyId(m),
      title: m.fullName,
      subtitle: this.roleLabel(m.role),
      meta: this.formatStartDate(m.startDate),
      cells: { endDate: this.formatStartDate(m.endDate ?? null), note: m.note ?? '' },
    }));
  });

  readonly moreItems = computed<MenuItem[]>(() => {
    this.lang();
    if (!this.ministry()?.isActive) return [];
    return [{
      label: this.translate.instant('ministry.detail.deactivate') as string,
      icon: 'pi pi-ban',
      command: ({ originalEvent }) => this.confirmDeactivate(originalEvent as Event),
    }];
  });

  ngOnInit(): void {
    this.loadMinistry();
    this.loadActiveMembers();
    this.loadHistory();
  }

  loadMinistry(): void {
    this.loading.set(true);
    this.ministryService.getMinistry(this.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: m => { this.ministry.set(m); this.loading.set(false); },
        error: () => {
          this.loading.set(false);
          this.toastError('ministry.detail.toast.loadFailed');
        },
      });
  }

  loadActiveMembers(): void {
    this.membersLoading.set(true);
    this.ministryService.getActiveMembers(this.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: members => { this.activeMembers.set(members); this.membersLoading.set(false); },
        error: () => {
          this.membersLoading.set(false);
          this.toastError('ministry.detail.toast.membersFailed');
        },
      });
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    this.ministryService.getMemberHistory(this.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: members => { this.history.set(members); this.historyLoading.set(false); },
        error: () => {
          this.historyLoading.set(false);
          this.toastError('ministry.detail.toast.historyFailed');
        },
      });
  }

  /** 역할 as a label; `—` when the server sent none. */
  roleLabel(role: MinistryAssignmentRole | undefined): string {
    return role ? this.translate.instant(`ministry.detail.roles.${role}`) as string : '—';
  }

  /** `25.03 – 26.01`, or `25.03 –` while ongoing — the ListCard meta on Phone. */
  /** The memo cell as plain text, for the truncated span and its tooltip. */
  noteOf(record: DataRecord): string {
    const note = record.cells?.['note'];
    return typeof note === 'string' ? note : '';
  }

  historyPeriod(record: DataRecord): string {
    const end = record.cells?.['endDate'];
    return end && end !== '—' ? `${record.meta} – ${end}` : `${record.meta} –`;
  }

  /** `YYYY-MM-DD` → `YY.MM`, as in the Figma table. */
  formatStartDate(date: string | null): string {
    if (!date) return '—';
    const [year, month] = date.split('-');
    return `${year.slice(2)}.${month}`;
  }

  openAddMember(): void { this.addDialogVisible.set(true); }

  /** Reload rather than append, so the order and count match the server. */
  onMemberAdded(): void { this.loadMembersAndHistory(); }

  openEditMember(publicId: string): void {
    this.editingMember.set(this.activeMembers().find(m => m.publicId === publicId) ?? null);
    this.editDialogVisible.set(true);
  }

  onMemberEdited(): void {
    this.toastSuccess('ministry.detail.toast.memberUpdated');
    this.loadMembersAndHistory();
  }

  onMemberEditFailed(): void { this.toastError('ministry.detail.toast.memberUpdateFailed'); }

  confirmRemoveMember(publicId: string): void {
    const member = this.activeMembers().find(m => m.publicId === publicId);
    if (!member) return;
    const t = (key: string) => this.translate.instant(`ministry.detail.removeDialog.${key}`) as string;
    this.confirmService.confirm({
      header: t('header'),
      message: this.translate.instant('ministry.detail.removeDialog.message', { name: member.fullName }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: t('accept'),
      rejectLabel: t('cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.removeMember(member.publicId),
    });
  }

  toggleMore(event: Event): void { this.moreMenu()?.toggle(event); }

  confirmDeactivate(event: Event): void {
    const t = (key: string) => this.translate.instant(`ministry.detail.deactivateDialog.${key}`) as string;
    this.confirmService.confirm({
      target: event.target as EventTarget,
      header: t('header'),
      message: this.translate.instant('ministry.detail.deactivateDialog.message', { title: this.ministry()?.title }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: t('accept'),
      rejectLabel: t('cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deactivate(),
    });
  }

  goToEdit(): void { this.router.navigate(['/ministry', this.publicId, 'edit']); }
  goBack(): void { this.router.navigate(['/ministry']); }

  /** Ends the assignment today; the member leaves the active list. */
  private removeMember(memberPublicId: string): void {
    this.assignments.endAssignment(memberPublicId, this.publicId, localDateToIso(new Date())!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastSuccess('ministry.detail.toast.memberRemoved');
          this.loadMembersAndHistory();
        },
        error: () => this.toastError('ministry.detail.toast.memberRemoveFailed'),
      });
  }

  /** Any change to the team is also a change to its history. */
  private loadMembersAndHistory(): void {
    this.loadActiveMembers();
    this.loadHistory();
  }

  private deactivate(): void {
    this.ministryService.deactivateMinistry(this.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastSuccess('ministry.detail.toast.deactivated');
          this.loadMinistry();
        },
        error: () => this.toastError('ministry.detail.toast.deactivateFailed'),
      });
  }

  private toastSuccess(detailKey: string): void {
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('ministry.detail.toast.done'),
      detail: this.translate.instant(detailKey),
    });
  }

  private toastError(detailKey: string): void {
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('ministry.detail.toast.error'),
      detail: this.translate.instant(detailKey),
    });
  }
}

function historyId(m: ActiveMinistryMemberDto): string {
  return `${m.publicId}:${m.startDate}`;
}
