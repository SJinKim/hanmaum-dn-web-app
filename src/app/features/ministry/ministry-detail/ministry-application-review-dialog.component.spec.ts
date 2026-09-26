import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { MinistryApplicationReviewDialogComponent } from './ministry-application-review-dialog.component';
import { MinistryService } from '../ministry.service';
import { ActiveMinistryMemberDto, MinistryRegistrationDto, MinistryReviewDecision } from '../ministry.model';

const APPLICANT: ActiveMinistryMemberDto = {
  publicId: 'p1', fullName: '최지원', startDate: '2026-09-20', note: null, gender: 'F',
  status: 'PENDING', selfIntroduction: '찬양을 좋아합니다', appliedAt: '2026-09-20T10:00:00',
};

const RESULT = {
  ministryPublicId: 'min-1', ministryName: '찬양팀', appliedAt: APPLICANT.appliedAt!,
  status: 'ACTIVE', leaderNotified: false, rejectionMessage: null,
} as MinistryRegistrationDto;

describe('MinistryApplicationReviewDialogComponent', () => {
  let service: jasmine.SpyObj<MinistryService>;

  function makeComponent() {
    const fixture = TestBed.createComponent(MinistryApplicationReviewDialogComponent);
    fixture.componentRef.setInput('ministryPublicId', 'min-1');
    fixture.componentRef.setInput('applicant', APPLICANT);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    service = jasmine.createSpyObj<MinistryService>('MinistryService', ['reviewApplication']);
    TestBed.configureTestingModule({
      imports: [MinistryApplicationReviewDialogComponent],
      providers: [{ provide: MinistryService, useValue: service }, provideTranslateService({ fallbackLang: 'ko' })],
    });
  });

  it('shows 신청자, 신청일 and 자기소개', async () => {
    const fixture = makeComponent();
    await fixture.whenStable();
    const body = document.body;
    expect(body.querySelector('[data-testid="review-applicant"]')?.textContent).toContain('최지원');
    expect(body.querySelector('[data-testid="review-applied-at"]')?.textContent).toContain('2026-09-20');
    expect(body.querySelector('[data-testid="review-self-introduction"]')?.textContent).toContain('찬양을 좋아합니다');
  });

  it('approve() sends APPROVE without a message, emits reviewed and closes', () => {
    service.reviewApplication.and.returnValue(of(RESULT));
    const c = makeComponent().componentInstance;
    const emitted: MinistryReviewDecision[] = [];
    c.reviewed.subscribe(d => emitted.push(d));

    c.approve();

    expect(service.reviewApplication).toHaveBeenCalledOnceWith('min-1', 'p1', { decision: 'APPROVE', message: null });
    expect(emitted).toEqual(['APPROVE']);
    expect(c.visible()).toBeFalse();
  });

  it('reject() without a message is blocked before it reaches the server', () => {
    const c = makeComponent().componentInstance;
    c.message.setValue('   ');

    c.reject();

    expect(service.reviewApplication).not.toHaveBeenCalled();
    expect(c.messageMissing()).toBeTrue();
    expect(c.visible()).toBeTrue();
  });

  it('reject() sends the trimmed message', () => {
    service.reviewApplication.and.returnValue(of({ ...RESULT, status: 'REJECTED', rejectionMessage: '다음 기회에' }));
    const c = makeComponent().componentInstance;
    const emitted: MinistryReviewDecision[] = [];
    c.reviewed.subscribe(d => emitted.push(d));
    c.message.setValue('  다음 기회에 ');

    c.reject();

    expect(service.reviewApplication).toHaveBeenCalledOnceWith('min-1', 'p1', { decision: 'REJECT', message: '다음 기회에' });
    expect(emitted).toEqual(['REJECT']);
  });

  it('keeps the dialog open and emits failed when the server refuses', () => {
    service.reviewApplication.and.returnValue(throwError(() => new Error('409')));
    const c = makeComponent().componentInstance;
    const failed: MinistryReviewDecision[] = [];
    c.failed.subscribe(d => failed.push(d));

    c.approve();

    expect(failed).toEqual(['APPROVE']);
    expect(c.visible()).toBeTrue();
    expect(c.sending()).toBeNull();
  });
});
