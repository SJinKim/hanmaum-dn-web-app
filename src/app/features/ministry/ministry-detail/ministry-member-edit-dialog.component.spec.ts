import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { Member } from '../../../core/models/member.model';
import { MinistryAssignmentService } from '../ministry-assignment.service';
import { ActiveMinistryMemberDto } from '../ministry.model';
import { MinistryMemberEditDialogComponent } from './ministry-member-edit-dialog.component';

const KO = {
  ministry: { detail: { editDialog: { roleHint: '역할·상태 지정은 준비 중입니다' } } },
};

const MEMBER = {
  publicId: 'm1', fullName: '김철수', startDate: '2023-03-01', note: '보컬', gender: 'M',
} as unknown as ActiveMinistryMemberDto;

describe('MinistryMemberEditDialogComponent', () => {
  let assignments: jasmine.SpyObj<MinistryAssignmentService>;

  function render(member: ActiveMinistryMemberDto | null = MEMBER) {
    assignments = jasmine.createSpyObj<MinistryAssignmentService>('MinistryAssignmentService', ['updateAssignment']);
    TestBed.configureTestingModule({
      imports: [MinistryMemberEditDialogComponent],
      providers: [
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: MinistryAssignmentService, useValue: assignments },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');

    const fixture = TestBed.createComponent(MinistryMemberEditDialogComponent);
    fixture.componentRef.setInput('ministryPublicId', 'min-1');
    fixture.componentRef.setInput('member', member);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    return fixture;
  }

  it('fills 시작일 and 메모 from the member', () => {
    const c = render().componentInstance;
    const { startDate, note } = c.form.getRawValue();
    expect(startDate).toEqual(new Date(2023, 2, 1));
    expect(note).toBe('보컬');
  });

  it('saves the ISO start date and trimmed note, then closes', () => {
    const c = render().componentInstance;
    assignments.updateAssignment.and.returnValue(of({} as Member));
    const saved = jasmine.createSpy('saved');
    c.saved.subscribe(saved);
    c.form.patchValue({ startDate: new Date(2023, 3, 15), note: '  리더  ' });

    c.submit();

    expect(assignments.updateAssignment).toHaveBeenCalledOnceWith('m1', 'min-1', {
      startDate: '2023-04-15', note: '리더',
    });
    expect(saved).toHaveBeenCalled();
    expect(c.visible()).toBeFalse();
  });

  it('sends an empty note as null', () => {
    const c = render().componentInstance;
    assignments.updateAssignment.and.returnValue(of({} as Member));
    c.form.patchValue({ note: '   ' });
    c.submit();
    expect(assignments.updateAssignment.calls.mostRecent().args[2].note).toBeNull();
  });

  it('requires 시작일', () => {
    const c = render().componentInstance;
    c.form.patchValue({ startDate: null });
    c.submit();
    expect(assignments.updateAssignment).not.toHaveBeenCalled();
    expect(c.hasError('startDate', 'required')).toBeTrue();
  });

  it('stays open and emits failed when saving fails', () => {
    const c = render().componentInstance;
    assignments.updateAssignment.and.returnValue(throwError(() => new Error('500')));
    const failed = jasmine.createSpy('failed');
    c.failed.subscribe(failed);

    c.submit();

    expect(failed).toHaveBeenCalled();
    expect(c.saving()).toBeFalse();
    expect(c.visible()).toBeTrue();
  });

  it('keeps 역할 and 상태 disabled with a hint', () => {
    const fixture = render();
    const { role, status } = fixture.componentInstance.form.controls;
    expect(role.disabled && status.disabled).toBeTrue();
    const hint = document.querySelector('[data-testid="role-hint"]') as HTMLElement;
    expect(hint.textContent).toContain('역할·상태 지정은 준비 중입니다');
  });
});
