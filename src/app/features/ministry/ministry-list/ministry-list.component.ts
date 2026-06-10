import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import { MinistryService } from '../ministry.service';
import { MinistrySummary } from '../ministry.model';

type ActiveFilter = boolean | null;

interface FilterTab {
  label: string;
  value: ActiveFilter;
}

@Component({
  selector: 'app-ministry-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    TagModule,
    ConfirmDialogModule,
    ToastModule,
    TooltipModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './ministry-list.component.html',
})
export class MinistryListComponent implements OnInit {
  private readonly ministryService = inject(MinistryService);
  private readonly router          = inject(Router);
  private readonly confirmService  = inject(ConfirmationService);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);

  ministries   = signal<MinistrySummary[]>([]);
  loading      = signal(false);
  activeFilter = signal<ActiveFilter>(null);

  readonly filterTabs: FilterTab[] = [
    { label: '전체',   value: null },
    { label: '활성',   value: true },
    { label: '비활성', value: false },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.ministryService.getMinistries(this.activeFilter()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => { this.ministries.set(list); this.loading.set(false); },
      error: ()  => {
        this.messageService.add({ severity: 'error', summary: '오류', detail: '부서 목록을 불러올 수 없습니다.' });
        this.loading.set(false);
      },
    });
  }

  onFilterTab(value: ActiveFilter): void {
    this.activeFilter.set(value);
    this.load();
  }

  goToCreate(): void { this.router.navigate(['/ministry', 'new']); }
  goToDetail(m: MinistrySummary): void { this.router.navigate(['/ministry', m.publicId]); }
  goToEdit(m: MinistrySummary, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/ministry', m.publicId, 'edit']);
  }

  confirmDeactivate(m: MinistrySummary, event: Event): void {
    event.stopPropagation();
    this.confirmService.confirm({
      target: event.target as EventTarget,
      message: `'${m.title}' 부서를 비활성화하시겠습니까?`,
      header: '부서 비활성화',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '비활성화',
      rejectLabel: '취소',
      acceptButtonStyleClass: 'p-button-warn',
      accept: () => this.deactivate(m),
    });
  }

  private deactivate(m: MinistrySummary): void {
    this.ministryService.deactivateMinistry(m.publicId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: '완료', detail: '비활성화되었습니다.' });
        this.load();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: '오류', detail: '비활성화에 실패했습니다.' });
      },
    });
  }
}
