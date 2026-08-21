import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MemberEditComponent } from './member-edit.component';
import { MemberService } from '../member.service';
import { MemberMinistryItem } from '../../../core/models/member-activity.model';

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

  it('addMinistry() pushes a card with ongoing=true; removeMinistry(0) empties the array', () => {
    expect(component.ministries.length).toBe(0);

    component.addMinistry();
    expect(component.ministries.length).toBe(1);
    expect(component.ministries.at(0).get('ongoing')!.value).toBeTrue();

    component.removeMinistry(0);
    expect(component.ministries.length).toBe(0);
  });

  it('toggling ongoing to false + onMinistryOngoingChange() enables endMonth', () => {
    component.addMinistry();
    const group = component.ministries.at(0);

    // Initially ongoing=true, endMonth is disabled
    expect(group.get('endMonth')!.disabled).toBeTrue();

    // Simulate the user unchecking "Ongoing"
    group.get('ongoing')!.setValue(false);
    component.onMinistryOngoingChange(0);

    expect(group.get('endMonth')!.enabled).toBeTrue();
    expect(group.get('endYear')!.enabled).toBeTrue();
  });

  it('collectMinistryItems() maps an ongoing card to the correct PUT item', () => {
    component.addMinistry();
    const group = component.ministries.at(0);
    group.patchValue({
      ministryPublicId: 'abc',
      startMonth: 3,
      startYear: 2024,
      ongoing: true,
    });

    const items: MemberMinistryItem[] = component['collectMinistryItems']();

    expect(items).toEqual([{
      ministryPublicId: 'abc',
      startDate: '2024-03-01',
      endDate: null,
      note: null,
    }]);
  });

  it('re-toggling ongoing back to true clears and disables the end date', () => {
    component.addMinistry();
    const group = component.ministries.at(0);

    // User unchecks Ongoing, enters an end date...
    group.get('ongoing')!.setValue(false);
    component.onMinistryOngoingChange(0);
    group.patchValue({ endMonth: 11, endYear: 2025 });

    // ...then re-checks Ongoing — the end date must be wiped and disabled again.
    group.get('ongoing')!.setValue(true);
    component.onMinistryOngoingChange(0);

    expect(group.get('endMonth')!.value).toBeNull();
    expect(group.get('endYear')!.value).toBeNull();
    expect(group.get('endMonth')!.disabled).toBeTrue();
  });

  it('collectMinistryItems() maps a finished card to a real endDate, and drops one missing its end date', () => {
    // Finished card with an end date → endDate populated.
    component.addMinistry();
    const finished = component.ministries.at(0);
    finished.get('ongoing')!.setValue(false);
    component.onMinistryOngoingChange(0);
    finished.patchValue({
      ministryPublicId: 'abc',
      startMonth: 3,
      startYear: 2024,
      endMonth: 5,
      endYear: 2025,
    });

    // Second finished card missing its end date → dropped by the filter.
    component.addMinistry();
    const incomplete = component.ministries.at(1);
    incomplete.get('ongoing')!.setValue(false);
    component.onMinistryOngoingChange(1);
    incomplete.patchValue({ ministryPublicId: 'def', startMonth: 1, startYear: 2023 });

    const items: MemberMinistryItem[] = component['collectMinistryItems']();

    expect(items).toEqual([{
      ministryPublicId: 'abc',
      startDate: '2024-03-01',
      endDate: '2025-05-01',
      note: null,
    }]);
  });
});

// Reproduction of the reported bug: a member loaded with an ONGOING ministry, edited
// via the real rendered checkbox to a finished (To month/year) assignment, must persist
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

  it('persists endDate when a loaded ongoing ministry is unchecked and given To dates', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    expect(component.ministries.length).toBe(1);
    const card = component.ministries.at(0);
    expect(card.get('ongoing')!.value).toBeTrue();
    expect(card.get('endMonth')!.disabled).toBeTrue();

    // Click the REAL Ongoing checkbox (PrimeNG renders an <input type=checkbox>).
    const checkbox = fixture.debugElement.query(By.css('#memberMinistryOngoing-0'));
    expect(checkbox).withContext('ongoing checkbox should be rendered').toBeTruthy();
    checkbox.nativeElement.click();
    fixture.detectChanges();

    // The toggle must flip the control AND enable the end-date fields.
    expect(card.get('ongoing')!.value).withContext('checkbox should set ongoing=false').toBeFalse();
    expect(card.get('endMonth')!.enabled).withContext('endMonth must be enabled after un-toggling').toBeTrue();
    expect(card.get('endYear')!.enabled).toBeTrue();

    // User selects To month/year, then saves.
    card.get('endMonth')!.setValue(11);
    card.get('endYear')!.setValue(2025);
    component.save();

    expect(replaceSpy).toHaveBeenCalled();
    const items = replaceSpy.calls.mostRecent().args[1] as MemberMinistryItem[];
    expect(items.length).toBe(1);
    expect(items[0].endDate).withContext('endDate must be persisted, not null').toBe('2025-11-01');
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
