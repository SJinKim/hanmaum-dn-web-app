import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MemberActionsCellComponent,
  MemberActionsContext,
} from './member-actions-cell.component';
import { MemberSummary, ChurchGroupSummary } from '../../../../core/models/member.model';

describe('MemberActionsCellComponent (approve)', () => {
  let fixture: ComponentFixture<MemberActionsCellComponent>;
  let component: MemberActionsCellComponent;
  let ctx: MemberActionsContext & {
    onApprove: jasmine.Spy;
    onEdit: jasmine.Spy;
    onGroupsMissing: jasmine.Spy;
  };

  const pendingMember = {
    publicId: 'm-1',
    lastName: '김',
    firstName: '철수',
    memberStatus: 'PENDING',
  } as MemberSummary;

  const groups: ChurchGroupSummary[] = [
    { publicId: 'g-1', division: null, name: '1순' },
    { publicId: 'g-2', division: null, name: '2순' },
  ];

  function init(churchGroups: ChurchGroupSummary[]): void {
    component.agInit({
      data: pendingMember,
      action: 'approve',
      context: ctx,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    ctx.churchGroups = churchGroups;
    fixture.detectChanges();
  }

  beforeEach(() => {
    ctx = {
      churchGroups: [],
      onApprove: jasmine.createSpy('onApprove'),
      onEdit: jasmine.createSpy('onEdit'),
      onGroupsMissing: jasmine.createSpy('onGroupsMissing'),
    };
    TestBed.configureTestingModule({ imports: [MemberActionsCellComponent] });
    fixture = TestBed.createComponent(MemberActionsCellComponent);
    component = fixture.componentInstance;
  });

  it('shows the approve button initially, no select', () => {
    init(groups);
    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('select')).toBeFalsy();
  });

  it('clicking approve swaps the button for a select with one option per group', () => {
    init(groups);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    expect(select).toBeTruthy();
    const labels = Array.from(select.options).map(o => o.textContent?.trim());
    expect(labels).toEqual(['순 선택…', '1순', '2순']);
  });

  it('choosing a group calls onApprove with the member and groupPublicId', () => {
    init(groups);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'g-2';
    select.dispatchEvent(new Event('change'));
    expect(ctx.onApprove).toHaveBeenCalledWith(pendingMember, 'g-2');
  });

  it('shows a spinner instead of the select while approval is in flight', () => {
    init(groups);
    ctx.onApprove.and.returnValue(new Promise<void>(() => { /* never settles */ }));
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'g-1';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pi-spinner')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('select')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('button')).toBeFalsy();
  });

  it('reverts to the approve button when approval fails', async () => {
    init(groups);
    ctx.onApprove.and.returnValue(Promise.reject(new Error('boom')));
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'g-1';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pi-spinner')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
  });

  it('cancel reverts back to the approve button without approving', () => {
    init(groups);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    const cancel: HTMLButtonElement =
      fixture.nativeElement.querySelector('button[aria-label="Cancel"]');
    cancel.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
    expect(ctx.onApprove).not.toHaveBeenCalled();
  });

  it('with no groups available, clicking approve calls onGroupsMissing and shows no select', () => {
    init([]);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(ctx.onGroupsMissing).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('select')).toBeFalsy();
  });
});
