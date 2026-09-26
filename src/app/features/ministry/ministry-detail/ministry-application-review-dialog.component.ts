import { Component, DestroyRef, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';

import { MinistryService } from '../ministry.service';
import { ActiveMinistryMemberDto, MinistryReviewDecision } from '../ministry.model';

export const REVIEW_MESSAGE_MAX = 500;

/**
 * 검토 of a self-application (HDN-170). Shows who applied, when and what they
 * wrote; 승인 makes them 활동, 거절 needs a message for the applicant.
 * No Figma frame yet — built from the Dialog/Medium kit like 팀원 수정.
 */
@Component({
  selector: 'app-ministry-application-review-dialog',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe,
    ButtonModule, DialogModule, InputTextModule, TextareaModule,
  ],
  templateUrl: './ministry-application-review-dialog.component.html',
})
export class MinistryApplicationReviewDialogComponent {
  private readonly ministryService = inject(MinistryService);
  private readonly destroyRef      = inject(DestroyRef);

  /** Two-way: parent controls open/close via [(visible)]. */
  readonly visible = model(false);
  readonly ministryPublicId = input.required<string>();
  readonly applicant = input<ActiveMinistryMemberDto | null>(null);

  readonly reviewed = output<MinistryReviewDecision>();
  readonly failed   = output<MinistryReviewDecision>();

  readonly messageMax = REVIEW_MESSAGE_MAX;
  /** The decision being sent, for the button's spinner; null while idle. */
  readonly sending = signal<MinistryReviewDecision | null>(null);
  /** Set by a 거절 without a message; the server would answer 400. */
  readonly messageMissing = signal(false);

  readonly dialogPt = {
    header: { style: { paddingBottom: 'var(--space-16)' } },
  };

  readonly message = new FormControl('', {
    nonNullable: true,
    validators: Validators.maxLength(REVIEW_MESSAGE_MAX),
  });

  constructor() {
    effect(() => {
      this.applicant();
      this.message.reset('');
      this.messageMissing.set(false);
    });
  }

  approve(): void { this.send('APPROVE'); }

  reject(): void {
    if (!this.message.value.trim()) {
      this.messageMissing.set(true);
      this.message.markAsTouched();
      return;
    }
    this.send('REJECT');
  }

  close(): void { this.visible.set(false); }

  private send(decision: MinistryReviewDecision): void {
    const a = this.applicant();
    if (!a || this.sending() || this.message.invalid) return;

    this.messageMissing.set(false);
    this.sending.set(decision);
    this.ministryService.reviewApplication(this.ministryPublicId(), a.publicId, {
      decision,
      message: this.message.value.trim() || null,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sending.set(null);
          this.reviewed.emit(decision);
          this.close();
        },
        error: () => {
          this.sending.set(null);
          this.failed.emit(decision);
        },
      });
  }
}
