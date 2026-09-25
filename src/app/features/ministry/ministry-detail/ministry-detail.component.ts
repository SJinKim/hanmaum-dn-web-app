import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Menu, MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';

import { injectAppLang } from '../../../core/i18n/language';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { DataTableComponent } from '../../../core/ui/data-table/data-table.component';
import { DataColumn, DataRecord } from '../../../core/ui/data-record.model';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { ListCardComponent } from '../../../core/ui/list-card/list-card.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { MinistryService } from '../ministry.service';
import { ActiveMinistryMemberDto, Ministry } from '../ministry.model';
import { localDateToIso } from '../../../core/models/member-activity.model';
import { MinistryAssignmentService } from '../ministry-assignment.service';
import { MinistryAddMemberDialogComponent } from './ministry-add-member-dialog.component';
import { MinistryMemberEditDialogComponent } from './ministry-member-edit-dialog.component';

/**
 * Figma: 사역 상세 · Desktop (204:6930). A header and one card 팀원; the table
 * becomes `app-list-card`s on Phone.
 *
 * 역할 shows `—` until the API carries a role per assignment
 * (hanmaum-dn-server#214). 관리 edits or ends an assignment through the
 * member's list (see MinistryAssignmentService); Phone has no 관리 yet.
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
      { type: 'actions', header: t('actions') },
    ];
  });

  readonly records = computed<DataRecord[]>(() => {
    this.lang();
    const active = this.translate.instant('ministry.detail.statusActive') as string;
    return this.activeMembers().map(m => ({
      id: m.publicId,
      title: m.fullName,
      subtitle: '—',
      badge: { variant: 'active', label: active },
      meta: this.formatStartDate(m.startDate),
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

  /** `YYYY-MM-DD` → `YY.MM`, as in the Figma table. */
  formatStartDate(date: string | null): string {
    if (!date) return '—';
    const [year, month] = date.split('-');
    return `${year.slice(2)}.${month}`;
  }

  openAddMember(): void { this.addDialogVisible.set(true); }

  /** Reload rather than append, so the order and count match the server. */
  onMemberAdded(): void { this.loadActiveMembers(); }

  openEditMember(publicId: string): void {
    this.editingMember.set(this.activeMembers().find(m => m.publicId === publicId) ?? null);
    this.editDialogVisible.set(true);
  }

  onMemberEdited(): void {
    this.toastSuccess('ministry.detail.toast.memberUpdated');
    this.loadActiveMembers();
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

  goToMember(publicId: string): void { this.router.navigate(['/members', publicId]); }
  goToEdit(): void { this.router.navigate(['/ministry', this.publicId, 'edit']); }
  goBack(): void { this.router.navigate(['/ministry']); }

  /** Ends the assignment today; the member leaves the active list. */
  private removeMember(memberPublicId: string): void {
    this.assignments.endAssignment(memberPublicId, this.publicId, localDateToIso(new Date())!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastSuccess('ministry.detail.toast.memberRemoved');
          this.loadActiveMembers();
        },
        error: () => this.toastError('ministry.detail.toast.memberRemoveFailed'),
      });
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
