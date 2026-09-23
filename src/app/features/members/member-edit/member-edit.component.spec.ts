import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MemberEditComponent } from './member-edit.component';
import { MemberService } from '../member.service';
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

describe('MemberEditComponent — 순장 checkbox', () => {
  const member = {
    publicId: 'm1', lastName: '김', firstName: '철수', discriminator: null, gender: null,
    baptism: null, birthDate: null, phoneNumber: null, email: null, street: null, houseNumber: null, zipCode: null,
    city: null, registrationDate: null, memberStatus: 'ACTIVE' as const, churchRole: null,
    groupPublicId: 'grp-1', groupName: '믿음',
    profileImageUrl: null, trainings: [], ministries: [],
    isGroupLeader: false,
  };

  const groups = [
    { publicId: 'grp-1', division: 'NEHEMIA', name: '믿음', leaderPublicId: 'other', leaderName: '박민수' },
    { publicId: 'grp-2', division: 'NEHEMIA', name: '소망' },
  ];

  function setup(loaded: Partial<typeof member> = {}) {
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
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: stub },
      ],
    });
    const fixture = TestBed.createComponent(MemberEditComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, assignSpy, clearSpy, updateSpy };
  }

  it('shows a replacement hint when checking 순장 on a group that already has another leader', () => {
    const { component } = setup();
    expect(component.leaderChangeHintName()).toBeNull();

    component.form.get('isGroupLeader')!.setValue(true);
    expect(component.leaderChangeHintName()).toBe('박민수');
  });

  it('does not hint when this member is already the group\'s 순장', () => {
    const { component } = setup({
      isGroupLeader: true,
    });
    // The loaded groups still list "other" as leader; override to this member.
    component['churchGroups'].set([{ ...groups[0], leaderPublicId: 'm1', leaderName: '김철수' }]);
    component.form.get('isGroupLeader')!.setValue(true);
    component.refreshLeaderHint();
    expect(component.leaderChangeHintName()).toBeNull();
  });

  it('calls assignGroupLeader after save when the checkbox is checked', () => {
    const { component, assignSpy, clearSpy, updateSpy } = setup();
    component.form.get('isGroupLeader')!.setValue(true);
    component.save();

    expect(updateSpy).toHaveBeenCalled();
    const req = updateSpy.calls.mostRecent().args[1] as { isNextGroupLeader?: boolean };
    expect(req.isNextGroupLeader).toBeFalse();
    expect(assignSpy).toHaveBeenCalledWith('grp-1', 'm1');
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('calls clearGroupLeader after save when the current 순장 is unchecked', () => {
    const { component, assignSpy, clearSpy } = setup({ isGroupLeader: true });
    component.form.get('isGroupLeader')!.setValue(false);
    component.save();

    expect(clearSpy).toHaveBeenCalledWith('grp-1');
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('does not re-assign when the current 순장 is saved unchanged', () => {
    const { component, assignSpy, clearSpy } = setup({ isGroupLeader: true });
    component.save();

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
