import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { MessageService } from 'primeng/api';

import { MinistryService } from '../ministry.service';
import { Ministry, ActiveMinistryMemberDto } from '../ministry.model';
import { MinistryAddMemberDialogComponent } from './ministry-add-member-dialog.component';

@Component({
  selector: 'app-ministry-detail',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    TagModule,
    TableModule,
    ToastModule,
    ProgressSpinnerModule,
    MinistryAddMemberDialogComponent,
  ],
  providers: [MessageService],
  templateUrl: './ministry-detail.component.html',
})
export class MinistryDetailComponent implements OnInit {
  private readonly ministryService = inject(MinistryService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);

  ministry       = signal<Ministry | null>(null);
  activeMembers  = signal<ActiveMinistryMemberDto[]>([]);
  loading        = signal(true);
  membersLoading = signal(false);
  addDialogVisible = signal(false);

  private publicId = '';

  ngOnInit(): void {
    this.publicId = this.route.snapshot.paramMap.get('publicId')!;
    this.loadMinistry();
    this.loadActiveMembers();
  }

  private loadMinistry(): void {
    this.ministryService.getMinistry(this.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: m => { this.ministry.set(m); this.loading.set(false); },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: '부서 정보를 불러올 수 없습니다.' });
          this.loading.set(false);
        },
      });
  }

  private loadActiveMembers(): void {
    this.membersLoading.set(true);
    this.ministryService.getActiveMembers(this.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => { this.activeMembers.set(list); this.membersLoading.set(false); },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: '회원 목록을 불러올 수 없습니다.' });
          this.membersLoading.set(false);
        },
      });
  }

  formatStartDate(dateStr: string): string {
    const [year, month] = dateStr.split('-');
    return `${year}년 ${parseInt(month, 10)}월`;
  }

  openAddMember(): void { this.addDialogVisible.set(true); }

  onMemberAdded(member: ActiveMinistryMemberDto): void {
    this.activeMembers.update(list => [...list, member]);
  }

  goToMember(publicId: string): void { this.router.navigate(['/members', publicId]); }
  goToEdit(): void { this.router.navigate(['/ministry', this.publicId, 'edit']); }
  goBack(): void   { this.router.navigate(['/ministry']); }
}
