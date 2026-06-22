import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { MinistryAddMemberDialogComponent } from './ministry-add-member-dialog.component';
import { MinistryService } from '../ministry.service';
import { ActiveMinistryMemberDto } from '../ministry.model';

describe('MinistryAddMemberDialogComponent', () => {
  let service: jasmine.SpyObj<MinistryService>;

  function makeComponent() {
    const fixture = TestBed.createComponent(MinistryAddMemberDialogComponent);
    fixture.componentRef.setInput('ministryPublicId', 'ministry-1');
    fixture.componentRef.setInput('visible', true);
    return fixture;
  }

  beforeEach(() => {
    service = jasmine.createSpyObj<MinistryService>('MinistryService', ['getMemberNames', 'addMember']);
    service.getMemberNames.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [MinistryAddMemberDialogComponent],
      providers: [{ provide: MinistryService, useValue: service }],
    });
  });

  it('memberLabel() appends the discriminator only when present', () => {
    const c = makeComponent().componentInstance;
    expect(c.memberLabel({ publicId: 'a', fullName: '김철수', discriminator: 'A' })).toBe('김철수 A');
    expect(c.memberLabel({ publicId: 'b', fullName: '이영희', discriminator: null })).toBe('이영희');
  });

  it('submit() posts the selected member with a first-of-month startDate and emits added', () => {
    const dto: ActiveMinistryMemberDto = {
      publicId: 'm1', fullName: '김철수', startDate: '2026-06-01', note: null, gender: 'M',
    };
    service.addMember.and.returnValue(of(dto));

    const fixture = makeComponent();
    const c = fixture.componentInstance;
    const emitted: ActiveMinistryMemberDto[] = [];
    c.added.subscribe(d => emitted.push(d));

    c.form.patchValue({ memberId: 'm1', startYear: 2026, startMonth: 6, note: '  ' });
    c.submit();

    expect(service.addMember).toHaveBeenCalledWith('ministry-1', {
      memberId: 'm1', startDate: '2026-06-01', note: null,
    });
    expect(emitted).toEqual([dto]);
    expect(c.visible()).toBeFalse();
  });

  it('onVisibleChange(false) hides the dialog and resets the form (X / backdrop dismiss)', () => {
    const c = makeComponent().componentInstance;
    c.form.patchValue({ memberId: 'm1', note: 'draft' });

    c.onVisibleChange(false);

    expect(c.visible()).toBeFalse();
    expect(c.form.value.memberId).toBeNull();
    expect(c.form.value.note).toBe('');
    expect(c.form.value.startMonth).toBe(new Date().getMonth() + 1);
  });

  it('submit() on 409 keeps the dialog open and does not emit', () => {
    service.addMember.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: '이 맴버는 이미 활동중입니다.' } })),
    );
    const fixture = makeComponent();
    const c = fixture.componentInstance;
    const emitted: ActiveMinistryMemberDto[] = [];
    c.added.subscribe(d => emitted.push(d));

    c.form.patchValue({ memberId: 'm1', startYear: 2026, startMonth: 6 });
    c.submit();

    expect(emitted).toEqual([]);
    expect(c.visible()).toBeTrue();
    expect(c.saving()).toBeFalse();
  });
});
