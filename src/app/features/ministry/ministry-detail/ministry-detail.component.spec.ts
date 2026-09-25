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
      columns: { name: '이름', role: '역할', status: '상태', startDate: '시작일', actions: '관리' },
      membersEmpty: { heading: '팀원이 없습니다' },
      notFound: { heading: '사역을 찾을 수 없습니다' },
    },
  },
};

const MINISTRY = {
  publicId: 'min-1', title: '찬양팀', subtitle: '주일 예배 찬양', isActive: true,
} as unknown as Ministry;

const MEMBERS = [
  { publicId: 'm1', fullName: '김철수', startDate: '2023-03-01', note: null, gender: 'M' },
  { publicId: 'm2', fullName: '이영희', startDate: null, note: null, gender: 'F' },
] as unknown as ActiveMinistryMemberDto[];

describe('MinistryDetailComponent', () => {
  let service: jasmine.SpyObj<MinistryService>;
  let assignments: jasmine.SpyObj<MinistryAssignmentService>;
  let isPhone: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    service = jasmine.createSpyObj<MinistryService>('MinistryService', [
      'getMinistry', 'getActiveMembers', 'deactivateMinistry', 'getMemberNames', 'addMember',
    ]);
    service.getMinistry.and.returnValue(of(MINISTRY));
    service.getActiveMembers.and.returnValue(of(MEMBERS));
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

  it('maps members to rows with 역할 —, badge 활동 and start date YY.MM', () => {
    const records = render().componentInstance.records();
    expect(records).toEqual([
      { id: 'm1', title: '김철수', subtitle: '—', badge: { variant: 'active', label: '활동' }, meta: '23.03' },
      { id: 'm2', title: '이영희', subtitle: '—', badge: { variant: 'active', label: '활동' }, meta: '—' },
    ]);
  });

  it('renders the table on desktop and list cards on phone', () => {
    let el: HTMLElement = render().nativeElement;
    expect(el.querySelector('app-data-table')).not.toBeNull();
    expect(el.querySelector('app-list-card')).toBeNull();

    isPhone.set(true);
    el = render().nativeElement;
    expect(el.querySelector('app-data-table')).toBeNull();
    expect(el.querySelectorAll('app-list-card').length).toBe(2);
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
    c.onMemberAdded();
    expect(service.getActiveMembers).toHaveBeenCalledOnceWith('min-1');
  });

  it('navigates to the member on row select and back to the list', () => {
    const c = render().componentInstance;
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    c.goToMember('m1');
    expect(router.navigate).toHaveBeenCalledWith(['/members', 'm1']);
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

  it('ends the assignment today after confirm and reloads the members', () => {
    const fixture = render();
    const c = fixture.componentInstance;
    const confirm = fixture.debugElement.injector.get(ConfirmationService);
    spyOn(confirm, 'confirm').and.callFake(opts => { opts.accept?.(); return confirm; });
    assignments.endAssignment.and.returnValue(of({} as Member));
    service.getActiveMembers.calls.reset();

    c.confirmRemoveMember('m1');

    expect(assignments.endAssignment).toHaveBeenCalledOnceWith('m1', 'min-1', localDateToIso(new Date())!);
    expect(service.getActiveMembers).toHaveBeenCalledOnceWith('min-1');
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
