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
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { MinistryService } from '../ministry.service';
import {
  CreateMinistryRequest,
  Ministry,
  MinistryContact,
  MinistrySchedule,
  UpdateMinistryRequest,
} from '../ministry.model';

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
    ToastModule,
    ProgressSpinnerModule,
  ],
  providers: [MessageService],
  templateUrl: './ministry-edit.component.html',
})
export class MinistryEditComponent implements OnInit {
  private readonly ministryService = inject(MinistryService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);

  isEdit   = false;
  loading  = signal(false);
  saving   = signal(false);

  readonly maxStructuredItems = 20;

  form = {
    title:        '',
    subtitle:     '',
    about:        '',
    requirements: [] as string[],
    schedules:    [] as MinistrySchedule[],
    contacts:     [] as MinistryContact[],
    imageUrl:     '',
    isActive:     true,
  };

  private publicId = '';

  ngOnInit(): void {
    this.publicId = this.route.snapshot.paramMap.get('publicId') ?? '';
    this.isEdit   = !!this.publicId;

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
    this.form.title        = m.title;
    this.form.subtitle     = m.subtitle;
    this.form.about        = m.about;
    this.form.requirements = [...m.requirements];
    this.form.schedules    = m.schedules.map(schedule => ({ ...schedule }));
    this.form.contacts     = m.contacts.map(contact => ({ ...contact }));
    this.form.imageUrl     = m.imageUrl ?? '';
    this.form.isActive     = m.isActive;
  }

  save(): void {
    const request = this.isEdit ? this.buildUpdateRequest() : this.buildCreateRequest();
    if (!request) return;

    this.saving.set(true);

    const request$ = this.isEdit
      ? this.ministryService.updateMinistry(this.publicId, request as UpdateMinistryRequest)
      : this.ministryService.createMinistry(request as CreateMinistryRequest);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ministry => {
        this.messageService.add({
          severity: 'success',
          summary: '완료',
          detail: this.isEdit ? '수정되었습니다.' : '부서가 생성되었습니다.',
        });
        setTimeout(() => this.router.navigate(['/ministry', ministry.publicId]), 800);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: '오류',
          detail: this.isEdit ? '수정에 실패했습니다.' : '생성에 실패했습니다.',
        });
        this.saving.set(false);
      },
    });
  }

  addRequirement(): void {
    if (this.form.requirements.length < this.maxStructuredItems) {
      this.form.requirements.push('');
    }
  }

  removeRequirement(index: number): void {
    this.form.requirements.splice(index, 1);
  }

  addSchedule(): void {
    if (this.form.schedules.length < this.maxStructuredItems) {
      this.form.schedules.push({ description: '', startTime: '', endTime: '' });
    }
  }

  removeSchedule(index: number): void {
    this.form.schedules.splice(index, 1);
  }

  addContact(): void {
    if (this.form.contacts.length < this.maxStructuredItems) {
      this.form.contacts.push({ role: '', name: '' });
    }
  }

  removeContact(index: number): void {
    this.form.contacts.splice(index, 1);
  }

  private buildCreateRequest(): CreateMinistryRequest | null {
    const structured = this.normalizedStructuredFields();
    if (!structured) return null;

    return {
      ...structured,
      imageUrl: this.form.imageUrl.trim() || null,
    };
  }

  private buildUpdateRequest(): UpdateMinistryRequest | null {
    const structured = this.normalizedStructuredFields();
    if (!structured) return null;

    return {
      ...structured,
      // PATCH treats null as "not supplied"; an empty string explicitly clears the image.
      imageUrl: this.form.imageUrl.trim(),
      isActive: this.form.isActive,
    };
  }

  private normalizedStructuredFields(): Omit<CreateMinistryRequest, 'imageUrl'> | null {
    const title = this.form.title.trim();
    const subtitle = this.form.subtitle.trim();
    const about = this.form.about.trim();

    if (!title || !subtitle || !about) {
      this.showValidationError('사역 제목, 부제목, 소개는 필수입니다.');
      return null;
    }

    const requirements = this.form.requirements.map(requirement => requirement.trim()).filter(Boolean);
    const schedules = this.form.schedules.map(schedule => ({
      description: schedule.description.trim(),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    }));
    const contacts = this.form.contacts.map(contact => ({
      role: contact.role.trim(),
      name: contact.name.trim(),
    }));

    if (schedules.some(schedule => !schedule.description || !schedule.startTime || !schedule.endTime)) {
      this.showValidationError('일정의 설명, 시작 시간, 종료 시간을 모두 입력해 주세요.');
      return null;
    }

    if (schedules.some(schedule => schedule.endTime <= schedule.startTime)) {
      this.showValidationError('일정의 종료 시간은 시작 시간보다 늦어야 합니다.');
      return null;
    }

    if (contacts.some(contact => !contact.role || !contact.name)) {
      this.showValidationError('연락처의 역할과 이름을 모두 입력해 주세요.');
      return null;
    }

    return { title, subtitle, about, requirements, schedules, contacts };
  }

  private showValidationError(detail: string): void {
    this.messageService.add({ severity: 'warn', summary: '입력 오류', detail });
  }

  goBack(): void {
    if (this.isEdit) {
      this.router.navigate(['/ministry', this.publicId]);
    } else {
      this.router.navigate(['/ministry']);
    }
  }
}
