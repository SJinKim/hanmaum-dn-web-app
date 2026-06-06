import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
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

    // Access private method via cast
    const items: MemberMinistryItem[] = (component as any).collectMinistryItems();

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

    const items: MemberMinistryItem[] = (component as any).collectMinistryItems();

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
    baptism: null, birthDate: null, phoneNumber: null, email: null, street: null, zipCode: null,
    city: null, registrationDate: null, memberStatus: 'ACTIVE', churchRole: null, groupName: null,
    profileImageUrl: null, trainings: [],
    ministries: [{ ministryPublicId: 'min1', name: '찬양팀', startDate: '2024-03-01', endDate: null, note: null }],
  };

  let replaceSpy: jasmine.Spy;

  function setup() {
    replaceSpy = jasmine.createSpy('replaceMemberMinistries').and.returnValue(of(memberWithOngoing));
    const memberServiceStub = {
      getTrainingCatalog: () => of([]),
      getMinistryCatalog: () => of([{ publicId: 'min1', name: '찬양팀' }]),
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
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'm1' }) } } },
        { provide: MemberService, useValue: memberServiceStub },
      ],
    });
    const fixture = TestBed.createComponent(MemberEditComponent);
    fixture.detectChanges(); // ngOnInit → stubbed loads resolve synchronously via of()
    return fixture;
  }

  it('persists endDate when a loaded ongoing ministry is unchecked and given To dates', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    expect(component.ministries.length).toBe(1);
    const card = component.ministries.at(0);
    expect(card.get('ongoing')!.value).toBeTrue();
    expect(card.get('endMonth')!.disabled).toBeTrue();

    // Click the REAL Ongoing checkbox (PrimeNG renders an <input type=checkbox>).
    const checkbox = fixture.debugElement.query(By.css('p-checkbox input[type="checkbox"]'));
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
