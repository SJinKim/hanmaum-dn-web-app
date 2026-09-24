import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { MemberEditComponent } from './member-edit.component';
import { MemberService } from '../member.service';
import { UNSAVED_CHANGES_DIALOG_KEY } from '../../../core/guards/unsaved-changes.guard';
import {
  MemberMinistryItem,
  MemberTrainingItem,
  TrainingCatalogEntry,
} from '../../../core/models/member-activity.model';

describe('MemberEditComponent — ministry editor', () => {
  let component: MemberEditComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        ConfirmationService,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MemberEditComponent);
    component = fixture.componentInstance;
  });

  it('addMinistry() pushes an empty card; removeMinistry(0) empties the array', () => {
    expect(component.ministries.length).toBe(0);

    component.addMinistry();
    expect(component.ministries.length).toBe(1);
    expect(component.ministries.at(0).get('endDate')!.value).toBeNull();

    component.removeMinistry(0);
    expect(component.ministries.length).toBe(0);
  });

  it('collectMinistryItems() maps an empty 종료일 to an ongoing PUT item', () => {
    component.addMinistry();
    component.ministries.at(0).patchValue({
      ministryPublicId: 'abc',
      startDate: new Date(2024, 2, 15),
    });

    const items: MemberMinistryItem[] = component['collectMinistryItems']();

    expect(items).toEqual([{
      ministryPublicId: 'abc',
      startDate: '2024-03-15',
      endDate: null,
      note: null,
    }]);
  });

  it('collectMinistryItems() sends the picked day of a finished row and drops a row without 시작일', () => {
    component.addMinistry();
    component.ministries.at(0).patchValue({
      ministryPublicId: 'abc',
      startDate: new Date(2024, 2, 15),
      endDate: new Date(2025, 4, 31),
    });
    component.addMinistry();
    component.ministries.at(1).patchValue({ ministryPublicId: 'def' });

    const items: MemberMinistryItem[] = component['collectMinistryItems']();

    expect(items).toEqual([
      { ministryPublicId: 'abc', startDate: '2024-03-15', endDate: '2025-05-31', note: null },
    ]);
  });

  it('clearing the 종료일 makes the assignment ongoing again', () => {
    component.addMinistry();
    const group = component.ministries.at(0);
    group.patchValue({ ministryPublicId: 'abc', startDate: new Date(2024, 2, 15), endDate: new Date(2025, 10, 3) });

    // PrimeNG showClear sets the control to null.
    group.get('endDate')!.setValue(null);

    const items: MemberMinistryItem[] = component['collectMinistryItems']();
    expect(items[0].endDate).toBeNull();
  });
});

// Reproduction of the reported bug: a member loaded with an ONGOING ministry, edited
// with a picked 종료일 to a finished assignment, must persist
// the endDate. Drives the actual DOM through a stubbed MemberService (no HTTP matching).
describe('MemberEditComponent — ongoing→finished (rendered, reported bug)', () => {
  const memberWithOngoing = {
    publicId: 'm1', lastName: '김', firstName: '철수', discriminator: null, gender: null,
    baptism: null, birthDate: null, phoneNumber: null, email: null, street: null, houseNumber: null, zipCode: null,
    city: null, registrationDate: null, memberStatus: 'ACTIVE', churchRole: null,
    groupPublicId: null, groupName: null,
    profileImageUrl: null, trainings: [],
    ministries: [{ ministryPublicId: 'min1', name: '찬양팀', startDate: '2024-03-01', endDate: null, note: null }],
  };

  let replaceSpy: jasmine.Spy;

  function setup() {
    replaceSpy = jasmine.createSpy('replaceMemberMinistries').and.returnValue(of(memberWithOngoing));
    const memberServiceStub = {
      getTrainingCatalog: () => of([]),
      getMinistryCatalog: () => of([{ publicId: 'min1', title: '찬양팀' }]),
      getChurchGroups: () => of([]),
      getMember: () => of(memberWithOngoing),
      updateMember: () => of(memberWithOngoing),
      createMember: () => of(memberWithOngoing),
      replaceMemberTrainings: () => of(memberWithOngoing),
      replaceMemberMinistries: replaceSpy,
    };

    TestBed.configureTestingModule({
      imports: [MemberEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        ConfirmationService,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: memberServiceStub },
      ],
    });
    const fixture = TestBed.createComponent(MemberEditComponent);
    fixture.detectChanges(); // ngOnInit → stubbed loads resolve synchronously via of()
    return fixture;
  }

  it('round-trips 등록일 through the datepicker and back to an ISO date', () => {
    const updateSpy = jasmine.createSpy('updateMember').and.returnValue(of(memberWithOngoing));
    const registered = { ...memberWithOngoing, registrationDate: '2019-04-01' };
    const memberServiceStub = {
      getTrainingCatalog: () => of([]),
      getMinistryCatalog: () => of([{ publicId: 'min1', name: '찬양팀' }]),
      getChurchGroups: () => of([]),
      getMember: () => of(registered),
      updateMember: updateSpy,
      createMember: () => of(registered),
      replaceMemberTrainings: () => of(registered),
      replaceMemberMinistries: () => of(registered),
    };

    TestBed.configureTestingModule({
      imports: [MemberEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        ConfirmationService,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: memberServiceStub },
      ],
    });
    const fixture = TestBed.createComponent(MemberEditComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    // Reverse-fill: the stored date becomes a local Date for the datepicker.
    expect(component.form.get('registrationDate')!.value).toEqual(new Date(2019, 3, 1));

    // The user picks any day; it is sent as-is.
    component.form.get('registrationDate')!.setValue(new Date(2019, 10, 17));
    component.save();

    const req = updateSpy.calls.mostRecent().args[1] as { registrationDate?: string };
    expect(req.registrationDate).toBe('2019-11-17');
  });

  it('sends groupPublicId="" when a loaded group is cleared, so the backend removes it', () => {
    const updateSpy = jasmine.createSpy('updateMember').and.returnValue(of(memberWithOngoing));
    const memberWithGroup = { ...memberWithOngoing, groupPublicId: 'grp-1', groupName: '믿음' };
    const memberServiceStub = {
      getTrainingCatalog: () => of([]),
      getMinistryCatalog: () => of([{ publicId: 'min1', name: '찬양팀' }]),
      getChurchGroups: () => of([{ publicId: 'grp-1', division: 'NEHEMIA', name: '믿음' }]),
      getMember: () => of(memberWithGroup),
      updateMember: updateSpy,
      createMember: () => of(memberWithOngoing),
      replaceMemberTrainings: () => of(memberWithOngoing),
      replaceMemberMinistries: () => of(memberWithOngoing),
    };

    TestBed.configureTestingModule({
      imports: [MemberEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        ConfirmationService,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: memberServiceStub },
      ],
    });
    const fixture = TestBed.createComponent(MemberEditComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    // Loaded with a group, the form holds its publicId.
    expect(component.form.get('groupPublicId')!.value).toBe('grp-1');

    // User clears the select (PrimeNG showClear → null), then saves.
    component.form.get('groupPublicId')!.setValue(null);
    component.save();

    expect(updateSpy).toHaveBeenCalled();
    const req = updateSpy.calls.mostRecent().args[1] as { groupPublicId?: string };
    expect(req.groupPublicId).withContext('cleared group must send "" to clear, not undefined').toBe('');
  });

  it('persists endDate when a loaded ongoing ministry is given a 종료일', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    expect(component.ministries.length).toBe(1);
    const card = component.ministries.at(0);
    expect(card.get('endDate')!.value).toBeNull();
    // Loaded ISO dates become local calendar dates.
    expect(card.get('startDate')!.value).toEqual(new Date(2024, 2, 1));

    // 사역 sits in its own tab now. `p-tabpanel` is not lazy, so the row is in the
    // DOM either way — activating the tab keeps the test honest about what the user
    // actually sees when they click it.
    component.activeTab.set(3);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#memberMinistryOngoing-0')))
      .withContext('the ongoing checkbox must be gone').toBeNull();
    expect(fixture.debugElement.query(By.css('#memberMinistryEndDate-0')))
      .withContext('the 종료일 row should render a date picker').toBeTruthy();

    // User picks a 종료일 on the calendar, then saves.
    card.get('endDate')!.setValue(new Date(2025, 10, 17));
    card.markAsDirty();
    component.save();

    expect(replaceSpy).toHaveBeenCalled();
    const items = replaceSpy.calls.mostRecent().args[1] as MemberMinistryItem[];
    expect(items.length).toBe(1);
    expect(items[0].endDate).withContext('endDate must be persisted, not null').toBe('2025-11-17');
  });
});

describe('MemberEditComponent — 순장', () => {
  const member = {
    publicId: 'm1', lastName: '김', firstName: '철수', discriminator: null, gender: null,
    baptism: null, birthDate: null, phoneNumber: null, email: null, street: null, houseNumber: null, zipCode: null,
    city: null, registrationDate: null, memberStatus: 'ACTIVE' as const, churchRole: null,
    groupPublicId: 'grp-1', groupName: '믿음',
    profileImageUrl: null, trainings: [], ministries: [],
    isGroupLeader: false as boolean,
    groupLeaderSince: null as string | null,
    lastGroupLeaderTenure: null as {
      groupPublicId: string; groupName: string; startDate: string; endDate: string | null;
    } | null,
  };

  const groups = [
    { publicId: 'grp-1', division: 'NEHEMIA', name: '믿음', leaderPublicId: 'other', leaderName: '박민수', leaderSince: '2025-01-05' },
    { publicId: 'grp-2', division: 'NEHEMIA', name: '소망' },
  ];

  const ko = {
    members: {
      edit: {
        leaderDialog: {
          assign: '{{name}}{{obj}} {{group}} 순장으로 지정할까요?',
          replace: '현재 순장 {{leader}} ({{since}}~){{topic}} 오늘 날짜로 종료됩니다.',
          end: '{{name}}의 {{group}} 순장 임기를 종료할까요? 종료일은 오늘({{today}})로 기록됩니다.',
          move: '{{name}}{{obj}} {{group}} 순장으로 옮길까요?',
          moveEndsOld: '{{group}} 순장 임기는 오늘 날짜로 종료됩니다.',
          moveReplace: '현재 {{group}} 순장 {{leader}} ({{since}}~)도 오늘 날짜로 종료됩니다.',
        },
      },
    },
  };

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /** `answer` decides every leader dialog: true = 예, false = 취소. */
  function setup(loaded: Partial<typeof member> = {}, answer = true) {
    const assignSpy = jasmine.createSpy('assignGroupLeader').and.returnValue(of(groups[0]));
    const clearSpy = jasmine.createSpy('clearGroupLeader').and.returnValue(of({
      ...groups[0], leaderPublicId: null, leaderName: null,
    }));
    const updateSpy = jasmine.createSpy('updateMember').and.returnValue(of({ ...member, ...loaded }));
    const stub = {
      getTrainingCatalog: () => of([]),
      getMinistryCatalog: () => of([]),
      getChurchGroups: () => of(groups),
      getMember: () => of({ ...member, ...loaded }),
      updateMember: updateSpy,
      createMember: () => of(member),
      replaceMemberTrainings: () => of({ ...member, ...loaded }),
      replaceMemberMinistries: () => of({ ...member, ...loaded }),
      assignGroupLeader: assignSpy,
      clearGroupLeader: clearSpy,
    };

    TestBed.configureTestingModule({
      imports: [MemberEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        ConfirmationService,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: stub },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', ko);
    translate.use('ko');

    const confirmSpy = spyOn(TestBed.inject(ConfirmationService), 'confirm').and.callFake(c => {
      if (c.key === 'leader-change') {
        if (answer) c.accept?.(); else c.reject?.();
      }
      return TestBed.inject(ConfirmationService);
    });
    const fixture = TestBed.createComponent(MemberEditComponent);
    fixture.detectChanges();
    const leaderDialogs = () => confirmSpy.calls.all().map(c => c.args[0]).filter(c => c.key === 'leader-change');
    return { fixture, component: fixture.componentInstance, assignSpy, clearSpy, updateSpy, leaderDialogs };
  }

  it('shows a replacement hint when checking 순장 on a group that already has another leader', () => {
    const { component } = setup();
    expect(component.leaderChangeHintName()).toBeNull();

    component.form.get('isGroupLeader')!.setValue(true);
    expect(component.leaderChangeHintName()).toBe('박민수');
  });

  it('does not hint when this member is already the group\'s 순장', () => {
    const { component } = setup({ isGroupLeader: true });
    component['churchGroups'].set([{ ...groups[0], leaderPublicId: 'm1', leaderName: '김철수' }]);
    component.refreshLeaderHint();
    expect(component.leaderChangeHintName()).toBeNull();
  });

  it('asks before assigning and names the replaced leader with leaderSince', () => {
    const { component, assignSpy, clearSpy, updateSpy, leaderDialogs } = setup();
    component.form.get('isGroupLeader')!.setValue(true);

    expect(leaderDialogs().length).toBe(1);
    expect(leaderDialogs()[0].message)
      .toBe('김철수를 믿음 순장으로 지정할까요? 현재 순장 박민수 (2025-01-05~)는 오늘 날짜로 종료됩니다.');
    expect(component.form.get('isGroupLeader')!.value).toBeTrue();
    expect(component.tenure()).toEqual(jasmine.objectContaining({ startDate: today(), endDate: null }));

    component.save();
    const req = updateSpy.calls.mostRecent().args[1] as { isNextGroupLeader?: boolean };
    expect(req.isNextGroupLeader).toBeFalse();
    expect(assignSpy).toHaveBeenCalledWith('grp-1', 'm1');
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('leaves the toggle off when the assign dialog is cancelled', () => {
    const { component, assignSpy } = setup({}, false);
    component.form.get('isGroupLeader')!.setValue(true);

    expect(component.form.get('isGroupLeader')!.value).toBeFalse();
    expect(component.form.get('isGroupLeader')!.dirty).toBeFalse();
    component.save();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('omits the replacement sentence when the 순 has no leader', () => {
    const { component, leaderDialogs } = setup({ groupPublicId: 'grp-2', groupName: '소망' });
    component.form.get('isGroupLeader')!.setValue(true);
    expect(leaderDialogs()[0].message).toBe('김철수를 소망 순장으로 지정할까요?');
  });

  it('asks before ending a tenure, shows today as end date and clears on save', () => {
    const { component, assignSpy, clearSpy, leaderDialogs } = setup({ isGroupLeader: true, groupLeaderSince: '2024-03-01' });
    expect(component.tenure()).toEqual(jasmine.objectContaining({ startDate: '2024-03-01', endDate: null, endHint: 'end' }));

    component.form.get('isGroupLeader')!.setValue(false);
    expect(leaderDialogs()[0].message)
      .toBe(`김철수의 믿음 순장 임기를 종료할까요? 종료일은 오늘(${today()})로 기록됩니다.`);
    expect(component.tenure()).toEqual(jasmine.objectContaining({ startDate: '2024-03-01', endDate: today(), endHint: 'pendingEnd' }));

    component.save();
    expect(clearSpy).toHaveBeenCalledWith('grp-1');
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('treats on → off → on before 저장 as undo: one dialog, end date back to —, no calls', () => {
    const { component, assignSpy, clearSpy, leaderDialogs } = setup({ isGroupLeader: true, groupLeaderSince: '2024-03-01' });
    component.form.get('isGroupLeader')!.setValue(false);
    component.form.get('isGroupLeader')!.setValue(true);

    expect(leaderDialogs().length).toBe(1);
    expect(component.tenure().endDate).toBeNull();
    component.save();
    expect(assignSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('asks before moving a 순장 and reverts the 순 on 취소', () => {
    const { component, leaderDialogs } = setup({ isGroupLeader: true }, false);
    component.form.get('groupPublicId')!.setValue('grp-2');

    expect(leaderDialogs()[0].message)
      .toBe('김철수를 소망 순장으로 옮길까요? 믿음 순장 임기는 오늘 날짜로 종료됩니다.');
    expect(component.form.get('groupPublicId')!.value).toBe('grp-1');
    expect(component.form.get('groupPublicId')!.dirty).toBeFalse();
  });

  it('names the target 순\'s leader when a move replaces them', () => {
    const { component, leaderDialogs } = setup({ isGroupLeader: true, groupPublicId: 'grp-2', groupName: '소망' });
    component.form.get('groupPublicId')!.setValue('grp-1');
    expect(leaderDialogs()[0].message).toBe(
      '김철수를 믿음 순장으로 옮길까요? 소망 순장 임기는 오늘 날짜로 종료됩니다. '
      + '현재 믿음 순장 박민수 (2025-01-05~)도 오늘 날짜로 종료됩니다.');
  });

  it('on a confirmed move PATCHes the new 순 and assigns there — the server ends the old tenure', () => {
    const { component, assignSpy, clearSpy, updateSpy } = setup({ isGroupLeader: true });
    component['churchGroups'].set([{ ...groups[0], leaderPublicId: 'm1', leaderName: '김철수' }, groups[1]]);
    assignSpy.and.returnValue(of({ ...groups[1], leaderPublicId: 'm1', leaderName: '김철수' }));
    component.form.get('groupPublicId')!.setValue('grp-2');
    component.save();

    const req = updateSpy.calls.mostRecent().args[1] as { groupPublicId?: string };
    expect(req.groupPublicId).toBe('grp-2');
    expect(assignSpy).toHaveBeenCalledWith('grp-2', 'm1');
    expect(clearSpy).not.toHaveBeenCalled();
    expect(component['churchGroups']().find(g => g.publicId === 'grp-1')!.leaderPublicId).toBeNull();
  });

  it('does not ask or call anything when the current 순장 is saved unchanged', () => {
    const { component, assignSpy, clearSpy, leaderDialogs } = setup({ isGroupLeader: true });
    component.save();

    expect(leaderDialogs().length).toBe(0);
    expect(assignSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('does not call clearGroupLeader when a 순장 is moved to another group unchecked', () => {
    const { component, assignSpy, clearSpy } = setup({ isGroupLeader: true });
    component.form.get('groupPublicId')!.setValue('grp-2');
    component.form.get('isGroupLeader')!.setValue(false);
    component.save();

    expect(clearSpy).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('shows a former 순장\'s last tenure, naming the 순 when it was another one', () => {
    const { component } = setup({
      lastGroupLeaderTenure: { groupPublicId: 'grp-2', groupName: '소망', startDate: '2024-03-01', endDate: '2026-09-10' },
    });
    expect(component.tenure()).toEqual({
      startDate: '2024-03-01', endDate: '2026-09-10', startHint: null, endHint: 'past', pastGroupName: '소망',
    });
  });

  it('starts a new tenure when a former 순장 is switched on again', () => {
    const { component, assignSpy, leaderDialogs } = setup({
      lastGroupLeaderTenure: { groupPublicId: 'grp-1', groupName: '믿음', startDate: '2024-03-01', endDate: '2026-09-10' },
    });
    expect(component.tenure().pastGroupName).toBeNull();

    component.form.get('isGroupLeader')!.setValue(true);
    expect(leaderDialogs().length).toBe(1);
    expect(component.tenure()).toEqual(jasmine.objectContaining({ startDate: today(), endDate: null }));
    component.save();
    expect(assignSpy).toHaveBeenCalledWith('grp-1', 'm1');
  });
});

// Reproduction of issue #27: after the server renamed the training catalog, saving a
// member sent `PUT /members/{id}/trainings` with an empty list and wiped the member's
// training history. The form now resolves trainings through the catalog and only
// replaces the set when the training form was actually edited.
describe('MemberEditComponent — training catalog', () => {
  const CATALOG: TrainingCatalogEntry[] = [
    { publicId: 'p-qtbs', code: 'QT_BASIC_SEMINAR', name: 'Quiet Time Basic Seminar',
      nameKo: '큐티베이직세미나', category: 'CORE', sortOrder: 1, hasCohorts: true,
      isActive: true, prerequisiteCode: null },
    { publicId: 'p-1on1', code: 'ONE_ON_ONE', name: 'One-to-One Discipleship Training',
      nameKo: '일대일제자양육', category: 'CORE', sortOrder: 2, hasCohorts: true,
      isActive: true, prerequisiteCode: 'QT_BASIC_SEMINAR' },
    { publicId: 'p-kairos', code: 'KAIROS', name: 'Kairos',
      nameKo: '카이로스', category: 'MISSION', sortOrder: 9, hasCohorts: false,
      isActive: false, prerequisiteCode: null },
  ];

  const member = {
    publicId: 'm1', lastName: '김', firstName: '철수', discriminator: null, gender: null,
    baptism: null, birthDate: null, phoneNumber: null, email: null, street: null,
    houseNumber: null, zipCode: null, city: null, registrationDate: null,
    memberStatus: 'ACTIVE' as const, churchRole: null, groupPublicId: null, groupName: null,
    profileImageUrl: null, ministries: [],
    trainings: [
      { trainingPublicId: 'p-qtbs', name: 'Quiet Time Basic Seminar',
        status: 'COMPLETED' as const, completedAt: '2023-05-01' },
      { trainingPublicId: 'p-1on1', name: 'One-to-One Discipleship Training',
        status: 'APPLIED' as const, completedAt: null },
    ],
  };

  function setup(catalog: TrainingCatalogEntry[] = CATALOG) {
    const replaceTrainingsSpy = jasmine
      .createSpy('replaceMemberTrainings').and.returnValue(of(member));
    const stub = {
      getTrainingCatalog: () => of(catalog),
      getMinistryCatalog: () => of([]),
      getChurchGroups: () => of([]),
      getMember: () => of(member),
      updateMember: () => of(member),
      createMember: () => of(member),
      replaceMemberTrainings: replaceTrainingsSpy,
      replaceMemberMinistries: () => of(member),
    };

    TestBed.configureTestingModule({
      imports: [MemberEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        ConfirmationService,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: stub },
      ],
    });
    const fixture = TestBed.createComponent(MemberEditComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, replaceTrainingsSpy };
  }

  it('rebuilds the training cards from the renamed catalog instead of dropping them', () => {
    const { component } = setup();

    expect(component.trainings.length).toBe(2);
    expect(component.trainings.at(0).get('code')!.value).toBe('QT_BASIC_SEMINAR');
    expect(component.trainings.at(0).get('status')!.value).toBe('COMPLETED');
    expect(component.trainings.at(0).get('completedAt')!.value).toEqual(new Date(2023, 4, 1));
    // A status the old two-value model could not represent survives the round trip.
    expect(component.trainings.at(1).get('status')!.value).toBe('APPLIED');
  });

  it('does NOT send the training PUT when the trainings were not touched', () => {
    const { component, replaceTrainingsSpy } = setup();

    component.form.get('lastName')!.setValue('박');
    component.save();

    expect(replaceTrainingsSpy)
      .withContext('an unrelated edit must never replace the training set')
      .not.toHaveBeenCalled();
  });

  it('sends the full training set once a training card is edited', () => {
    const { component, replaceTrainingsSpy } = setup();

    const status = component.trainings.at(1).get('status')!;
    status.setValue('COMPLETED');
    // What Angular's value accessor does on a real edit; setValue() alone does not.
    status.markAsDirty();
    component.onTrainingStatusChange(1);
    // Any day from the calendar, not just the 1st.
    component.trainings.at(1).patchValue({ completedAt: new Date(2025, 10, 17) });
    component.save();

    expect(replaceTrainingsSpy).toHaveBeenCalled();
    const items = replaceTrainingsSpy.calls.mostRecent().args[1] as MemberTrainingItem[];
    expect(items).toEqual([
      { trainingPublicId: 'p-qtbs', status: 'COMPLETED', completedAt: '2023-05-01' },
      { trainingPublicId: 'p-1on1', status: 'COMPLETED', completedAt: '2025-11-17' },
    ]);
  });

  it('skips the training PUT when the catalog failed to load', () => {
    const { component, replaceTrainingsSpy } = setup([]);

    component.addTraining();
    component.save();

    expect(replaceTrainingsSpy).not.toHaveBeenCalled();
  });

  it('marks the training form dirty when a card is added or removed', () => {
    const { component } = setup();

    expect(component.trainings.dirty)
      .withContext('a freshly loaded member is not an edit').toBeFalse();
    component.removeTraining(0);
    expect(component.trainings.dirty).toBeTrue();
  });

  it('offers the active courses, minus the ones already picked in other rows', () => {
    const { component } = setup();

    // Row 0 holds QT_BASIC_SEMINAR, row 1 holds ONE_ON_ONE.
    expect(component.availableTrainingOptions(0).map(o => o.value)).toEqual(['QT_BASIC_SEMINAR']);
    expect(component.maxTrainings()).toBe(2);
  });

  it('keeps a retired course selectable for the member who holds it', () => {
    const withKairos = {
      ...member,
      trainings: [{ trainingPublicId: 'p-kairos', name: 'Kairos',
        status: 'COMPLETED' as const, completedAt: '2022-01-01' }],
    };
    const stub = {
      getTrainingCatalog: () => of(CATALOG),
      getMinistryCatalog: () => of([]),
      getChurchGroups: () => of([]),
      getMember: () => of(withKairos),
      updateMember: () => of(withKairos),
      createMember: () => of(withKairos),
      replaceMemberTrainings: () => of(withKairos),
      replaceMemberMinistries: () => of(withKairos),
    };
    TestBed.configureTestingModule({
      imports: [MemberEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        ConfirmationService,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: stub },
      ],
    });
    const fixture = TestBed.createComponent(MemberEditComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.trainings.at(0).get('code')!.value).toBe('KAIROS');
    expect(component.availableTrainingOptions(0).map(o => o.value)).toContain('KAIROS');
  });
});

// #75: die 양육- und 사역-Reiter sind Zeilenlisten mit Hinzufügen/Entfernen und einem
// Leerzustand statt der Liste. Getestet wird am gerenderten DOM, weil genau dort die
// Regressionen sitzen (Labels nur in Zeile 1, Papierkorb an der richtigen Zeile).
describe('MemberEditComponent — 양육 / 사역 Zeilen', () => {
  const CATALOG: TrainingCatalogEntry[] = [
    { publicId: 'p-qtbs', code: 'QT_BASIC_SEMINAR', name: 'Quiet Time Basic Seminar',
      nameKo: '큐티베이직세미나', category: 'CORE', sortOrder: 1, hasCohorts: true,
      isActive: true, prerequisiteCode: null },
    { publicId: 'p-1on1', code: 'ONE_ON_ONE', name: 'One-to-One Discipleship Training',
      nameKo: '일대일제자양육', category: 'CORE', sortOrder: 2, hasCohorts: true,
      isActive: true, prerequisiteCode: null },
  ];

  const member = {
    publicId: 'm1', lastName: '김', firstName: '철수', discriminator: null, gender: null,
    baptism: null, birthDate: null, phoneNumber: null, email: null, street: null,
    houseNumber: null, zipCode: null, city: null, registrationDate: null,
    memberStatus: 'ACTIVE' as const, churchRole: null, groupPublicId: null, groupName: null,
    profileImageUrl: null, trainings: [], ministries: [],
  };

  function setup() {
    const stub = {
      getTrainingCatalog: () => of(CATALOG),
      getMinistryCatalog: () => of([{ publicId: 'min1', name: '찬양팀' }]),
      getChurchGroups: () => of([]),
      getMember: () => of(member),
      updateMember: () => of(member),
      createMember: () => of(member),
      replaceMemberTrainings: () => of(member),
      replaceMemberMinistries: () => of(member),
    };

    TestBed.configureTestingModule({
      imports: [MemberEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        ConfirmationService,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: stub },
      ],
    });
    const fixture = TestBed.createComponent(MemberEditComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('양육: shows the empty state until the first row exists', () => {
    const { fixture, component } = setup();
    component.activeTab.set(2);
    fixture.detectChanges();

    // `p-tabpanel` is not lazy, so 양육 and 사역 both render their empty state —
    // count them rather than asserting on a single one.
    const emptyStates = () => fixture.debugElement.queryAll(By.css('app-empty-state')).length;

    expect(component.trainings.length).toBe(0);
    expect(emptyStates()).withContext('both empty tabs render EmptyState/NoData').toBe(2);
    expect(fixture.debugElement.query(By.css('#memberTrainingCode-0'))).toBeNull();

    component.addTraining();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#memberTrainingCode-0')))
      .withContext('the added row must render its 양육-Select').toBeTruthy();
    expect(emptyStates()).withContext('only 사역 is still empty').toBe(1);
  });

  it('양육: labels are rendered for the first row only', () => {
    const { fixture, component } = setup();
    component.activeTab.set(2);
    component.addTraining();
    component.addTraining();
    fixture.detectChanges();

    expect(component.trainings.length).toBe(2);
    expect(fixture.debugElement.query(By.css('label[for="memberTrainingCode-0"]'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('label[for="memberTrainingCode-1"]')))
      .withContext('DESIGN.md §9.1: Labels nur in der ersten Zeile').toBeNull();
    // The second row is still announced — its label lives on the select's aria-label.
    expect(fixture.debugElement.query(By.css('#memberTrainingCode-1'))).toBeTruthy();
  });

  it('양육: the row trash button removes exactly its own row', () => {
    const { fixture, component } = setup();
    component.activeTab.set(2);
    component.addTraining();
    component.trainings.at(0).get('code')!.setValue('QT_BASIC_SEMINAR');
    component.addTraining();
    component.trainings.at(1).get('code')!.setValue('ONE_ON_ONE');
    fixture.detectChanges();

    const trash = fixture.debugElement
      .queryAll(By.css('button[aria-label="members.edit.training.remove"]'));
    expect(trash.length).withContext('one trash button per row').toBe(2);

    trash[0].nativeElement.click();
    fixture.detectChanges();

    expect(component.trainings.length).toBe(1);
    expect(component.trainings.at(0).get('code')!.value).toBe('ONE_ON_ONE');
  });

  it('사역: add and remove work the same way', () => {
    const { fixture, component } = setup();
    component.activeTab.set(3);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#memberMinistry-0'))).toBeNull();

    component.addMinistry();
    component.addMinistry();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#memberMinistry-1'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('label[for="memberMinistry-1"]'))).toBeNull();

    const trash = fixture.debugElement
      .queryAll(By.css('button[aria-label="members.edit.ministry.remove"]'));
    expect(trash.length).toBe(2);

    trash[1].nativeElement.click();
    fixture.detectChanges();

    expect(component.ministries.length).toBe(1);
  });
});

// #76: the unsaved-changes guard asks only after a real user edit, never after
// the form was pre-filled on load, and never once 저장 has gone through.
describe('MemberEditComponent — unsaved changes', () => {
  const member = {
    publicId: 'm1', lastName: '김', firstName: '철수', discriminator: null, gender: 'MALE',
    baptism: null, birthDate: '1995-04-12', phoneNumber: '+4917647384957', email: 'a@b.de',
    street: null, houseNumber: null, zipCode: null, city: 'Düsseldorf',
    registrationDate: '2023-09-01', memberStatus: 'ACTIVE', churchRole: null,
    groupPublicId: 'grp-1', groupName: '믿음', isGroupLeader: true,
    profileImageUrl: null, trainings: [],
    ministries: [{ ministryPublicId: 'min1', name: '찬양팀', startDate: '2024-03-01', endDate: null, note: null }],
  };

  function setup(publicId: string | null) {
    const stub = {
      getTrainingCatalog: () => of([]),
      getMinistryCatalog: () => of([{ publicId: 'min1', title: '찬양팀' }]),
      getChurchGroups: () => of([{ publicId: 'grp-1', division: 'NEHEMIA', name: '믿음', leaderPublicId: 'm1' }]),
      getMember: () => of(member),
      updateMember: () => of(member),
      createMember: () => of(member),
      replaceMemberTrainings: () => of(member),
      replaceMemberMinistries: () => of(member),
      assignGroupLeader: () => of({}),
      clearGroupLeader: () => of({}),
    };

    TestBed.configureTestingModule({
      imports: [MemberEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        ConfirmationService,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(publicId ? { publicId } : {}) } } },
        { provide: MemberService, useValue: stub },
      ],
    });
    const fixture = TestBed.createComponent(MemberEditComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('reports no changes after loading and rendering every tab', () => {
    const { fixture, component } = setup('m1');
    // Each tab renders its own controls; none may mark the form dirty on write.
    for (const tab of [0, 1, 2, 3]) {
      component.activeTab.set(tab);
      fixture.detectChanges();
    }
    expect(component.form.get('lastName')!.value).toBe('김');
    expect(component.hasUnsavedChanges()).toBeFalse();
  });

  it('hosts the dialog the guard opens', () => {
    const { fixture } = setup('m1');
    const dialog = fixture.debugElement.query(By.css('p-confirmdialog'));
    expect(dialog.componentInstance.key).toBe(UNSAVED_CHANGES_DIALOG_KEY);
  });

  it('reports no changes on an untouched create form', () => {
    const { component } = setup(null);
    expect(component.hasUnsavedChanges()).toBeFalse();
  });

  it('reports changes once the user edits a field', () => {
    const { fixture, component } = setup('m1');
    const input: HTMLInputElement = fixture.debugElement.query(By.css('input[formControlName="city"]')).nativeElement;
    input.value = 'Köln';
    input.dispatchEvent(new Event('input'));
    expect(component.hasUnsavedChanges()).toBeTrue();
  });

  it('reports changes after removing a 사역 row', () => {
    const { component } = setup('m1');
    component.removeMinistry(0);
    expect(component.hasUnsavedChanges()).toBeTrue();
  });

  it('reports no changes after a successful 저장', () => {
    const { component } = setup('m1');
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.form.get('city')!.markAsDirty();
    component.form.get('city')!.setValue('Köln');

    component.save();

    expect(navigate).toHaveBeenCalledWith(['/members', 'm1']);
    expect(component.hasUnsavedChanges()).toBeFalse();
  });

  it('keeps the changes when 저장 fails', () => {
    const { component } = setup('m1');
    spyOn(TestBed.inject(MemberService), 'updateMember').and.returnValue(throwError(() => new Error('500')));
    component.form.get('city')!.markAsDirty();

    component.save();

    expect(component.hasUnsavedChanges()).toBeTrue();
  });
});

// hanmaum-dn-server#197: 직업 is a stored field, loaded into the form and sent on 저장.
describe('MemberEditComponent — 직업', () => {
  const member = {
    publicId: 'm1', lastName: '김', firstName: '철수', discriminator: null, gender: null,
    baptism: null, birthDate: null, phoneNumber: null, email: null, street: null, houseNumber: null,
    zipCode: null, city: null, registrationDate: null, memberStatus: 'ACTIVE', churchRole: null,
    groupPublicId: null, groupName: null, isGroupLeader: false,
    profileImageUrl: null, trainings: [], ministries: [],
    occupation: null as string | null,
  };

  function setup(publicId: string | null, occupation: string | null = null) {
    const loaded = { ...member, occupation };
    const updateSpy = jasmine.createSpy('updateMember').and.returnValue(of(loaded));
    const createSpy = jasmine.createSpy('createMember').and.returnValue(of(loaded));
    const stub = {
      getTrainingCatalog: () => of([]),
      getMinistryCatalog: () => of([]),
      getChurchGroups: () => of([]),
      getMember: () => of(loaded),
      updateMember: updateSpy,
      createMember: createSpy,
      replaceMemberTrainings: () => of(loaded),
      replaceMemberMinistries: () => of(loaded),
      assignGroupLeader: () => of({}),
      clearGroupLeader: () => of({}),
    };

    TestBed.configureTestingModule({
      imports: [MemberEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        ConfirmationService,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(publicId ? { publicId } : {}) } } },
        { provide: MemberService, useValue: stub },
      ],
    });
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(MemberEditComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const sent = () => updateSpy.calls.mostRecent().args[1];
    return { fixture, component, updateSpy, createSpy, sent };
  }

  it('loads the saved occupation into an enabled control', () => {
    const { fixture, component } = setup('m1', '간호사');
    const input: HTMLInputElement = fixture.debugElement.query(By.css('#memberOccupation')).nativeElement;
    expect(component.form.get('occupation')!.value).toBe('간호사');
    expect(input.disabled).toBeFalse();
  });

  it('sends the trimmed occupation on 저장', () => {
    const { component, sent } = setup('m1');
    component.form.get('occupation')!.setValue('  개발자 ');
    component.save();
    expect(sent().occupation).toBe('개발자');
  });

  it('sends an empty string to clear a saved occupation', () => {
    const { component, sent } = setup('m1', '간호사');
    component.form.get('occupation')!.setValue('');
    component.save();
    expect(sent().occupation).toBe('');
  });

  it('omits an occupation that was never set', () => {
    const { component, sent } = setup('m1');
    component.save();
    expect(sent().occupation).toBeUndefined();
  });

  it('sends the occupation when registering a new member', () => {
    const { component, createSpy } = setup(null);
    component.form.patchValue({ lastName: '이', firstName: '영희', occupation: '교사' });
    component.save();
    expect(createSpy.calls.mostRecent().args[0].occupation).toBe('교사');
  });
});
