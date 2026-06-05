import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { MemberEditComponent } from './member-edit.component';
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
