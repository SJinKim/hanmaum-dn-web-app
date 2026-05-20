// src/app/features/members/members-list/members-list.component.ts
import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap, BehaviorSubject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { MemberService } from '../member.service';
import { MemberSummary, MemberStatus, Baptism, BAPTISM_LABELS } from '../../../core/models/member.model';

type StatusFilter  = MemberStatus | null;
type RoleFilter    = 'ADMIN' | 'MEMBER' | null;
type BaptismFilter = Baptism | null;

@Component({
  selector: 'app-members-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TableModule,
    InputTextModule,
    ButtonModule,
    SelectModule,
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

  members      = signal<MemberSummary[]>([]);
  totalRecords = signal(0);
  pendingCount = this.memberService.pendingCount;
  loading      = signal(false);
  searchTerm   = '';
  activeStatus  = signal<StatusFilter>(null);
  activeRole    = signal<RoleFilter>(null);
  activeBaptism = signal<BaptismFilter>(null);

  page = 0;
  size = 20;

  readonly roleOptions = [
    { label: 'All Roles', value: null },
    { label: 'Admin',     value: 'ADMIN' },
    { label: 'Member',    value: 'MEMBER' },
  ];

  readonly statusOptions = [
    { label: 'All Status', value: null      },
    { label: 'Active',     value: 'ACTIVE'  },
    { label: 'Inactive',   value: 'INACTIVE'},
    { label: 'Pending',    value: 'PENDING' },
    { label: 'Deleted',    value: 'DELETED' },
  ];

  readonly baptismOptions = [
    { label: 'All Baptism', value: null as Baptism | null },
    ...(Object.entries(BAPTISM_LABELS) as [Baptism, string][])
      .map(([value, label]) => ({ label, value })),
  ];

  private readonly search$ = new Subject<string>();
  private readonly loadTrigger$ = new BehaviorSubject<void>(undefined);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.search$.complete());
    this.destroyRef.onDestroy(() => this.loadTrigger$.complete());

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const status = params.get('status') as StatusFilter;
        if (status && status !== this.activeStatus()) {
          this.activeStatus.set(status);
        }
      });

    this.loadTrigger$
      .pipe(
        switchMap(() =>
          this.memberService.getMembers({
            search: this.searchTerm,
            status: this.activeStatus(),
            role: this.activeRole() ?? undefined,
            baptism: this.activeBaptism() ?? undefined,
            page: this.page,
            size: this.size,
          })
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: res => {
          this.members.set(this.sortByKoreanName(res.content));
          this.totalRecords.set(res.totalElements);
          this.loading.set(false);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not load members.' });
          this.loading.set(false);
        },
      });

    this.memberService.refreshPendingCount();
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => { this.searchTerm = term; this.loadPage(0); });
  }

  loadPage(page: number): void {
    this.page = page;
    this.loading.set(true);
    this.loadTrigger$.next();
  }

  onSearch(term: string): void { this.search$.next(term); }

  onStatusChange(value: StatusFilter): void   { this.activeStatus.set(value);  this.loadPage(0); }
  onRoleChange(value: RoleFilter): void       { this.activeRole.set(value);    this.loadPage(0); }
  onBaptismChange(value: BaptismFilter): void { this.activeBaptism.set(value); this.loadPage(0); }
  showPendingOnly(): void                   { this.activeStatus.set('PENDING'); this.loadPage(0); }

  onPageChange(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows  = event.rows  ?? this.size;
    this.size = rows;
    this.loadPage(first / rows);
  }

  goToDetail(member: MemberSummary): void { this.router.navigate(['/members', member.publicId]); }
  goToEdit(member: MemberSummary, event: Event): void { event.stopPropagation(); this.router.navigate(['/members', member.publicId, 'edit']); }
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
        next: () => { this.messageService.add({ severity: 'success', summary: 'Done', detail: 'Member approved.' }); this.loadPage(this.page); this.memberService.refreshPendingCount(); },
        error: () => { this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Approval failed.' }); },
      });
  }

  statusBadgeClass(status: MemberStatus): string {
    const map: Record<MemberStatus, string> = { ACTIVE: 'badge-active', INACTIVE: 'badge-inactive', PENDING: 'badge-pending', DELETED: 'badge-deleted' };
    return map[status] ?? '';
  }

  roleBadgeClass(role?: string): string { return role === 'ADMIN' ? 'badge-admin' : 'badge-member'; }

  showingFrom(): number { return this.page * this.size + 1; }
  showingTo(): number   { return Math.min((this.page + 1) * this.size, this.totalRecords()); }

  baptismLabel(b?: Baptism | null): string {
    return b ? BAPTISM_LABELS[b] : '—';
  }

  private sortByKoreanName(list: MemberSummary[]): MemberSummary[] {
    const collator = new Intl.Collator('ko', { sensitivity: 'base' });
    return [...list].sort((a, b) =>
      collator.compare(`${a.lastName}${a.firstName}`, `${b.lastName}${b.firstName}`),
    );
  }
}
