import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { MinistryService } from '../ministry.service';
import { Ministry } from '../ministry.model';
import { MemberService } from '../../members/member.service';

@Component({
  selector: 'app-ministry-edit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    CheckboxModule,
    SelectModule,
    ToastModule,
    ProgressSpinnerModule,
  ],
  providers: [MessageService],
  templateUrl: './ministry-edit.component.html',
})
export class MinistryEditComponent implements OnInit {
  private readonly ministryService = inject(MinistryService);
  private readonly memberService   = inject(MemberService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);

  isEdit   = false;
  loading  = signal(false);
  saving   = signal(false);

  memberOptions = signal<{ value: string; label: string }[]>([]);

  form = {
    name:             '',
    shortDescription: '',
    longDescription:  '',
    imageUrl:         '',
    leaderPublicId:   null as string | null,
    isActive:         true,
  };

  private publicId = '';

  ngOnInit(): void {
    this.publicId = this.route.snapshot.paramMap.get('publicId') ?? '';
    this.isEdit   = !!this.publicId;

    this.memberService.getMembers({ size: 500 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.memberOptions.set(
            page.content.map(m => ({ value: m.publicId, label: `${m.lastName}${m.firstName}` }))
          );
        },
      });

    if (this.isEdit) {
      this.loading.set(true);
      this.ministryService.getMinistry(this.publicId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: m => { this.fillForm(m); this.loading.set(false); },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: '부서 정보를 불러올 수 없습니다.' });
          this.loading.set(false);
        },
      });
    }
  }

  private fillForm(m: Ministry): void {
    this.form.name             = m.name;
    this.form.shortDescription = m.shortDescription;
    this.form.longDescription  = m.longDescription ?? '';
    this.form.imageUrl         = m.imageUrl ?? '';
    this.form.leaderPublicId   = m.leader?.publicId ?? null;
    this.form.isActive         = m.isActive;
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.shortDescription.trim()) {
      this.messageService.add({ severity: 'warn', summary: '입력 오류', detail: '부서명과 짧은 설명은 필수입니다.' });
      return;
    }

    this.saving.set(true);

    if (this.isEdit) {
      const req: Record<string, unknown> = {
        name:             this.form.name.trim(),
        shortDescription: this.form.shortDescription.trim(),
        isActive:         this.form.isActive,
      };
      if (this.form.longDescription.trim()) req['longDescription'] = this.form.longDescription.trim();
      if (this.form.imageUrl.trim())        req['imageUrl']        = this.form.imageUrl.trim();
      if (this.form.leaderPublicId)         req['leaderPublicId']  = this.form.leaderPublicId;

      this.ministryService.updateMinistry(this.publicId, req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: '완료', detail: '수정되었습니다.' });
          setTimeout(() => this.router.navigate(['/ministry', this.publicId]), 800);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: '수정에 실패했습니다.' });
          this.saving.set(false);
        },
      });
    } else {
      const req: Record<string, unknown> = {
        name:             this.form.name.trim(),
        shortDescription: this.form.shortDescription.trim(),
      };
      if (this.form.longDescription.trim()) req['longDescription'] = this.form.longDescription.trim();
      if (this.form.imageUrl.trim())        req['imageUrl']        = this.form.imageUrl.trim();
      if (this.form.leaderPublicId)         req['leaderPublicId']  = this.form.leaderPublicId;

      this.ministryService.createMinistry(req as never).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: m => {
          this.messageService.add({ severity: 'success', summary: '완료', detail: '부서가 생성되었습니다.' });
          setTimeout(() => this.router.navigate(['/ministry', m.publicId]), 800);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: '생성에 실패했습니다.' });
          this.saving.set(false);
        },
      });
    }
  }

  goBack(): void {
    if (this.isEdit) {
      this.router.navigate(['/ministry', this.publicId]);
    } else {
      this.router.navigate(['/ministry']);
    }
  }
}
