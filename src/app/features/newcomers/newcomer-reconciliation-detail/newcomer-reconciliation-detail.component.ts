import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { Observable } from 'rxjs';

import {
  RECONCILIATION_FIELDS,
  Reconciliation,
  ReconciliationError,
  ReconciliationField,
  ReconciliationMember,
  reconciliationError,
  reconciliationValue,
} from '../../../core/models/reconciliation.model';
import { RoleService } from '../../../core/services/role.service';
import { BadgeComponent } from '../../../core/ui/badge/badge.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { STATUS_BADGE } from '../newcomer-reconciliations/newcomer-reconciliations.component';
import { ReconciliationService } from '../reconciliation.service';

interface Column {
  readonly member: ReconciliationMember;
  readonly registration: boolean;
  readonly selected: boolean;
  readonly name: string;
}

interface Cell {
  readonly value: string;
  /** A candidate value that is not the registration's. */
  readonly differs: boolean;
}

interface FieldRow {
  readonly field: ReconciliationField;
  readonly cells: readonly Cell[];
}

type Action = 'link' | 'merge';

/** Errors after which the shown state is no longer the server's. */
const RELOAD_ON: readonly ReconciliationError[] = ['resolved', 'stale', 'notCandidate', 'memberInactive'];

/**
 * 계정 연결 확인 — 비교 (#45), Figma 1028:105799. Shows the registration next to
 * every candidate account and lets the 새가족팀 link it to one of them or dismiss
 * the match. Link and merge copy the registration's input onto the chosen account.
 */
@Component({
  selector: 'app-newcomer-reconciliation-detail',
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    ButtonModule,
    ConfirmDialogModule,
    ToastModule,
    BadgeComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  providers: [ConfirmationService, MessageService],
  host: { class: 'flex flex-col' },
  templateUrl: './newcomer-reconciliation-detail.component.html',
})
export class NewcomerReconciliationDetailComponent implements OnInit {
  private readonly service = inject(ReconciliationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmService = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly roles = inject(RoleService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly publicId = this.route.snapshot.paramMap.get('publicId');

  readonly statusBadge = STATUS_BADGE;
  readonly canWrite = computed(() => this.roles.canWrite('newcomers'));

  readonly item = signal<Reconciliation | null>(null);
  readonly loading = signal(true);
  readonly failed = signal<'notFound' | 'error' | null>(null);
  /** publicId of the account being linked, or `dismiss`. */
  readonly busy = signal<string | null>(null);

  readonly editable = computed(() => this.canWrite() && this.item()?.status === 'OPEN');

  readonly name = computed(() => {
    const item = this.item();
    return item ? reconciliationValue(item.registrationMember, 'name') : '';
  });

  readonly breadcrumb = computed(() => {
    this.translate.currentLang();
    return [
      this.translate.instant('newcomers.title') as string,
      this.translate.instant('newcomers.reconciliation.title') as string,
      this.name(),
    ];
  });

  readonly columns = computed<readonly Column[]>(() => {
    const item = this.item();
    if (!item) return [];
    const column = (member: ReconciliationMember, registration: boolean): Column => ({
      member,
      registration,
      selected: !registration && member.publicId === item.selectedMemberPublicId,
      name: reconciliationValue(member, 'name'),
    });
    return [column(item.registrationMember, true), ...item.candidates.map(c => column(c, false))];
  });

  readonly rows = computed<readonly FieldRow[]>(() => {
    const columns = this.columns();
    if (!columns.length) return [];
    return RECONCILIATION_FIELDS.map(field => {
      const own = reconciliationValue(columns[0].member, field);
      return {
        field,
        cells: columns.map((c, i) => {
          const value = reconciliationValue(c.member, field);
          return { value, differs: i > 0 && value !== own };
        }),
      };
    });
  });

  readonly reasons = computed(() => {
    this.translate.currentLang();
    return (this.item()?.reasons ?? []).map(r => this.label('reason', r));
  });

  /** Conflicting fields the response does not carry, so they cannot be shown side by side. */
  readonly hiddenConflicts = computed(() => {
    this.translate.currentLang();
    const shown = new Set<string>(RECONCILIATION_FIELDS);
    const hidden = (this.item()?.conflictFields ?? []).filter(f => !shown.has(f));
    return hidden.length ? hidden.map(f => this.label('field', f)).join(', ') : null;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.publicId) {
      this.loading.set(false);
      this.failed.set('notFound');
      return;
    }
    this.loading.set(true);
    this.failed.set(null);
    this.service
      .get(this.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: item => {
          this.item.set(item);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.failed.set(err.status === 404 ? 'notFound' : 'error');
        },
      });
  }

  confirmLink(column: Column): void {
    this.ask('link', column);
  }

  confirmDismiss(): void {
    const t = (key: string) => this.translate.instant(`newcomers.reconciliation.dismissDialog.${key}`) as string;
    this.confirmService.confirm({
      header: t('header'),
      message: t('message'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: t('accept'),
      rejectLabel: t('cancel'),
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => this.dismiss(),
    });
  }

  goToList(): void {
    void this.router.navigate(['/newcomers', 'reconciliations']);
  }

  private ask(action: Action, column: Column): void {
    const t = (key: string) =>
      this.translate.instant(`newcomers.reconciliation.${action}Dialog.${key}`, { name: column.name }) as string;
    this.confirmService.confirm({
      header: t('header'),
      message: t('message'),
      icon: 'pi pi-link',
      acceptLabel: t('accept'),
      rejectLabel: t('cancel'),
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => this.resolve(action, column),
    });
  }

  private resolve(action: Action, column: Column): void {
    const item = this.item();
    if (!item || this.busy()) return;
    const body = { memberPublicId: column.member.publicId, version: item.version };
    const call = action === 'link' ? this.service.link(item.publicId, body) : this.service.merge(item.publicId, body);
    this.run(column.member.publicId, call, action === 'link' ? 'linked' : 'merged', error => {
      // Both sides have 새가족 history: the server only accepts a merge.
      if (action === 'link' && error === 'useMerge') {
        this.ask('merge', column);
        return true;
      }
      return false;
    });
  }

  private dismiss(): void {
    const item = this.item();
    if (!item || this.busy()) return;
    this.run('dismiss', this.service.dismiss(item.publicId, item.version), 'dismissed');
  }

  private run(
    busy: string,
    call: Observable<Reconciliation>,
    success: string,
    handled: (error: ReconciliationError) => boolean = () => false,
  ): void {
    this.busy.set(busy);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.busy.set(null);
        this.item.set(updated);
        this.toast('success', success);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(null);
        const error = reconciliationError(err.status, err.error?.message);
        if (handled(error)) return;
        this.toast('error', `errors.${error}`);
        if (error === 'notFound') {
          this.item.set(null);
          this.failed.set('notFound');
        } else if (RELOAD_ON.includes(error)) {
          this.load();
        }
      },
    });
  }

  private toast(severity: 'success' | 'error', key: string): void {
    this.messages.add({
      severity,
      summary: this.translate.instant(`newcomers.reconciliation.toast.${key}`) as string,
    });
  }

  /** A server value without a translation is shown as is, never as a key. */
  private label(group: 'reason' | 'field', value: string): string {
    const key = `newcomers.reconciliation.${group}.${value}`;
    const text = this.translate.instant(key) as string;
    return text === key ? value : text;
  }
}
