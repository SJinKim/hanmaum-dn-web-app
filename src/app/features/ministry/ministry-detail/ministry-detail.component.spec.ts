import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { localDateToIso } from '../../../core/models/member-activity.model';
import { Member } from '../../../core/models/member.model';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { MinistryAssignmentService } from '../ministry-assignment.service';
import { MinistryDetailComponent } from './ministry-detail.component';
import { MinistryService } from '../ministry.service';
import { ActiveMinistryMemberDto, Ministry } from '../ministry.model';

const KO = {
  ministry: {
    title: '사역',
    memberCount: '팀원 {{count}}명',
    detail: {
      members: '팀원',
      addMember: '팀원 추가',
      statusActive: '활동',
      deactivate: '비활성화',
      history: '팀원 히스토리',
      roles: { LEADER: '리더', SUB_LEADER: '부리더', MEMBER: '팀원' },
      columns: {
        name: '이름', role: '역할', status: '상태', startDate: '시작일', endDate: '종료일', note: '메모', actions: '관리',
      },
      membersEmpty: { heading: '팀원이 없습니다' },
      notFound: { heading: '사역을 찾을 수 없습니다' },
    },
  },
};

const MINISTRY = {
  publicId: 'min-1', title: '찬양팀', subtitle: '주일 예배 찬양', isActive: true,
} as unknown as Ministry;

const MEMBERS = [
  { publicId: 'm1', fullName: '김철수', startDate: '2023-03-01', note: null, gender: 'M', role: 'LEADER' },
  { publicId: 'm2', fullName: '이영희', startDate: null, note: '반주', gender: 'F' },
] as unknown as ActiveMinistryMemberDto[];

const HISTORY = [
  MEMBERS[0],
  { publicId: 'm3', fullName: '박민수', startDate: '2021-01-01', endDate: '2022-06-01', note: '군 입대', gender: 'M', role: 'MEMBER' },
  { publicId: 'm3', fullName: '박민수', startDate: '2019-03-01', endDate: '2020-02-01', note: null, gender: 'M', role: 'SUB_LEADER' },
] as unknown as ActiveMinistryMemberDto[];

describe('MinistryDetailComponent', () => {
  let service: jasmine.SpyObj<MinistryService>;
  let assignments: jasmine.SpyObj<MinistryAssignmentService>;
  let isPhone: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    service = jasmine.createSpyObj<MinistryService>('MinistryService', [
      'getMinistry', 'getActiveMembers', 'getMemberHistory', 'deactivateMinistry', 'getMemberNames', 'addMember',
    ]);
    service.getMinistry.and.returnValue(of(MINISTRY));
    service.getActiveMembers.and.returnValue(of(MEMBERS));
    service.getMemberHistory.and.returnValue(of(HISTORY));
    service.getMemberNames.and.returnValue(of([]));
    assignments = jasmine.createSpyObj<MinistryAssignmentService>('MinistryAssignmentService', [
      'updateAssignment', 'endAssignment',
    ]);
    isPhone = signal(false);

    TestBed.configureTestingModule({
      imports: [MinistryDetailComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: MinistryService, useValue: service },
        { provide: MinistryAssignmentService, useValue: assignments },
        { provide: BreakpointService, useValue: { isPhone } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'min-1' }) } } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');
  });

  function render() {
    const fixture = TestBed.createComponent(MinistryDetailComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the title as heading and "{subtitle} · 팀원 N명" as subtitle', () => {
    const fixture = render();
    const c = fixture.componentInstance;
    expect(c.breadcrumb()).toEqual(['사역', '찬양팀']);
    expect(c.subtitle()).toBe('주일 예배 찬양 · 팀원 2명');
    expect(fixture.nativeElement.textContent).toContain('찬양팀');
  });

  it('leaves out an empty ministry subtitle', () => {
    service.getMinistry.and.returnValue(of({ ...MINISTRY, subtitle: '' }));
    expect(render().componentInstance.subtitle()).toBe('팀원 2명');
  });

  it('maps members to rows with 역할, badge 활동, start date YY.MM and 메모', () => {
    const records = render().componentInstance.records();
    expect(records).toEqual([
      { id: 'm1', title: '김철수', subtitle: '리더', badge: { variant: 'active', label: '활동' }, meta: '23.03', cells: { note: '' } },
      { id: 'm2', title: '이영희', subtitle: '—', badge: { variant: 'active', label: '활동' }, meta: '—', cells: { note: '반주' } },
    ]);
  });

  it('truncates 메모 in the table and keeps the full text as tooltip source', () => {
    const el: HTMLElement = render().nativeElement;
    const note = Array.from(el.querySelectorAll('[data-testid="members-card"] td span.truncate'))
      .find(n => n.textContent?.trim() === '반주');
    expect(note).toBeDefined();
  });

  it('maps every assignment, current and ended, to a history row keyed by member and 시작일', () => {
    const records = render().componentInstance.historyRecords();
    expect(records).toEqual([
      { id: 'm1:2023-03-01', title: '김철수', subtitle: '리더', meta: '23.03', cells: { endDate: '—', note: '' } },
      { id: 'm3:2021-01-01', title: '박민수', subtitle: '팀원', meta: '21.01', cells: { endDate: '22.06', note: '군 입대' } },
      { id: 'm3:2019-03-01', title: '박민수', subtitle: '부리더', meta: '19.03', cells: { endDate: '20.02', note: '' } },
    ]);
  });

  it('shows the history without 상태 or 관리, so it cannot be edited', () => {
    const c = render().componentInstance;
    expect(c.historyColumns().map(col => col.header)).toEqual(['이름', '역할', '시작일', '종료일', '메모']);
    const el: HTMLElement = render().nativeElement;
    const history = el.querySelector('[data-testid="history-card"]')!;
    expect(history.querySelector('.pi-pencil')).toBeNull();
    expect(history.querySelector('.pi-trash')).toBeNull();
    expect(history.querySelector('p-button')).toBeNull();
  });

  it('keeps both tables read-only: no row opens the member detail', () => {
    const fixture = render();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('tr[tabindex]').length).toBe(0);
    el.querySelector<HTMLElement>('tbody tr')!.click();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('opens 수정 from an active card and keeps history cards read-only on phone', () => {
    isPhone.set(true);
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector<HTMLButtonElement>('[data-testid="members-card"] app-list-card button')!.click();
    expect(fixture.componentInstance.editingMember()).toBe(MEMBERS[0]);
    expect(fixture.componentInstance.editDialogVisible()).toBeTrue();
    expect(el.querySelector('[data-testid="history-card"] app-list-card button')).toBeNull();
  });

  it('shows the history period as ListCard meta on phone', () => {
    const c = render().componentInstance;
    const [current, ended] = c.historyRecords();
    expect(c.historyPeriod(current)).toBe('23.03 –');
    expect(c.historyPeriod(ended)).toBe('21.01 – 22.06');
  });

  it('renders the table on desktop and list cards on phone', () => {
    let el: HTMLElement = render().nativeElement;
    expect(el.querySelector('app-data-table')).not.toBeNull();
    expect(el.querySelector('app-list-card')).toBeNull();

    isPhone.set(true);
    el = render().nativeElement;
    expect(el.querySelector('app-data-table')).toBeNull();
    expect(el.querySelectorAll('[data-testid="members-card"] app-list-card').length).toBe(2);
    expect(el.querySelectorAll('[data-testid="history-card"] app-list-card').length).toBe(3);
  });

  it('shows the not-found state when the ministry fails to load', () => {
    service.getMinistry.and.returnValue(throwError(() => new Error('404')));
    const el: HTMLElement = render().nativeElement;
    expect(el.textContent).toContain('사역을 찾을 수 없습니다');
    expect(el.querySelector('[data-testid="members-card"]')).toBeNull();
  });

  it('reloads the members after one was added', () => {
    const c = render().componentInstance;
    service.getActiveMembers.calls.reset();
    service.getMemberHistory.calls.reset();
    c.onMemberAdded();
    expect(service.getActiveMembers).toHaveBeenCalledOnceWith('min-1');
    expect(service.getMemberHistory).toHaveBeenCalledOnceWith('min-1');
  });

  it('navigates to 수정', () => {
    const c = render().componentInstance;
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    c.goToEdit();
    expect(router.navigate).toHaveBeenCalledWith(['/ministry', 'min-1', 'edit']);
  });

  it('offers 비활성화 only while active and deactivates after confirm', () => {
    const fixture = render();
    const c = fixture.componentInstance;
    expect(c.moreItems().map(i => i.label)).toEqual(['비활성화']);

    const confirm = fixture.debugElement.injector.get(ConfirmationService);
    spyOn(confirm, 'confirm').and.callFake(opts => { opts.accept?.(); return confirm; });
    service.deactivateMinistry.and.returnValue(of(void 0));
    service.getMinistry.and.returnValue(of({ ...MINISTRY, isActive: false }));

    c.confirmDeactivate(new Event('click'));

    expect(service.deactivateMinistry).toHaveBeenCalledWith('min-1');
    expect(c.moreItems()).toEqual([]);
  });

  it('opens the edit dialog with the chosen member', () => {
    const c = render().componentInstance;
    c.openEditMember('m1');
    expect(c.editingMember()).toBe(MEMBERS[0]);
    expect(c.editDialogVisible()).toBeTrue();
  });

  it('ends the assignment today after confirm and reloads the members and history', () => {
    const fixture = render();
    const c = fixture.componentInstance;
    const confirm = fixture.debugElement.injector.get(ConfirmationService);
    spyOn(confirm, 'confirm').and.callFake(opts => { opts.accept?.(); return confirm; });
    assignments.endAssignment.and.returnValue(of({} as Member));
    service.getActiveMembers.calls.reset();
    service.getMemberHistory.calls.reset();

    c.confirmRemoveMember('m1');

    expect(assignments.endAssignment).toHaveBeenCalledOnceWith('m1', 'min-1', localDateToIso(new Date())!);
    expect(service.getActiveMembers).toHaveBeenCalledOnceWith('min-1');
    expect(service.getMemberHistory).toHaveBeenCalledOnceWith('min-1');
  });

  it('shows an error toast and keeps the list when ending fails', () => {
    const fixture = render();
    const c = fixture.componentInstance;
    const confirm = fixture.debugElement.injector.get(ConfirmationService);
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(confirm, 'confirm').and.callFake(opts => { opts.accept?.(); return confirm; });
    spyOn(messages, 'add');
    assignments.endAssignment.and.returnValue(throwError(() => new Error('500')));
    service.getActiveMembers.calls.reset();

    c.confirmRemoveMember('m1');

    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(service.getActiveMembers).not.toHaveBeenCalled();
  });
});
