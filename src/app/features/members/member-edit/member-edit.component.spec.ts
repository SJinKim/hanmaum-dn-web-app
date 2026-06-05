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
});
