import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChurchGroupsListComponent } from './church-groups-list.component';

describe('ChurchGroupsListComponent', () => {
  let component: ChurchGroupsListComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ChurchGroupsListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    component = TestBed.createComponent(ChurchGroupsListComponent).componentInstance;
  });

  describe('toggleCategory', () => {
    it('adds a category when not present', () => {
      component.toggleCategory('NEXT_LEADER');
      expect(component.activeCategories().has('NEXT_LEADER')).toBeTrue();
    });

    it('removes a category when already active', () => {
      component.toggleCategory('NEXT_LEADER');
      component.toggleCategory('NEXT_LEADER');
      expect(component.activeCategories().has('NEXT_LEADER')).toBeFalse();
    });

    it('can have multiple categories active simultaneously', () => {
      component.toggleCategory('NEXT_LEADER');
      component.toggleCategory('UNBAPTIZED');
      expect(component.activeCategories().size).toBe(2);
    });
  });

  describe('isDimmed', () => {
    it('returns false for any category when nothing is active (show all)', () => {
      expect(component.isDimmed('NEXT_LEADER')).toBeFalse();
    });

    it('returns false for an active category', () => {
      component.toggleCategory('NEXT_LEADER');
      expect(component.isDimmed('NEXT_LEADER')).toBeFalse();
    });

    it('returns true for a category not in the active set', () => {
      component.toggleCategory('NEXT_LEADER');
      expect(component.isDimmed('UNBAPTIZED')).toBeTrue();
    });

    it('returns false for all categories once the set is empty again', () => {
      component.toggleCategory('NEXT_LEADER');
      component.toggleCategory('NEXT_LEADER');
      expect(component.isDimmed('UNBAPTIZED')).toBeFalse();
    });

    it('does not dim DISCIPLESHIP_COMPLETED when only NEXT_LEADER is active', () => {
      component.toggleCategory('NEXT_LEADER');
      expect(component.isDimmed('DISCIPLESHIP_COMPLETED')).toBeFalse();
    });

    it('still dims other non-NEXT_LEADER categories when NEXT_LEADER is active', () => {
      component.toggleCategory('NEXT_LEADER');
      expect(component.isDimmed('ONE_ON_ONE_COMPLETED')).toBeTrue();
    });
  });
});
