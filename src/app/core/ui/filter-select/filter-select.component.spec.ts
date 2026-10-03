import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FilterChipComponent } from '../filter-chip/filter-chip.component';
import { FilterSelectComponent, FilterSelectOption } from './filter-select.component';

@Component({
  standalone: true,
  imports: [FilterSelectComponent],
  template: `<app-filter-select label="상태" [options]="options" [value]="value()" (valueChange)="chosen.push($event); value.set($event)" />`,
})
class HostComponent {
  readonly options: FilterSelectOption<string>[] = [
    { label: '전체', value: null },
    { label: '대기중', value: 'PENDING' },
    { label: '활성', value: 'ACTIVE' },
  ];
  readonly value = signal<string | null>(null);
  readonly chosen: (string | null)[] = [];
}

// Figma: 청년 · 필터 칩 (열림) (949:96712).
describe('FilterSelectComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const chip = () => fixture.debugElement.query(By.directive(FilterChipComponent)).componentInstance as FilterChipComponent;
    const openList = () => {
      (fixture.nativeElement.querySelector('app-filter-chip button') as HTMLButtonElement).click();
      fixture.detectChanges();
      return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
    };
    return { fixture, host: fixture.componentInstance, chip, openList };
  }

  afterEach(() => document.querySelectorAll('.p-popover').forEach(el => el.remove()));

  it('shows the bare column name, unselected, while 전체 is chosen', () => {
    const { chip } = setup();
    expect(chip().label()).toBe('상태');
    expect(chip().selected()).toBeFalse();
  });

  it('shows "상태 · 활성" and Selected once a value is set', () => {
    const { fixture, host, chip } = setup();
    host.value.set('ACTIVE');
    fixture.detectChanges();
    expect(chip().label()).toBe('상태 · 활성');
    expect(chip().selected()).toBeTrue();
  });

  it('opens the options on a chip click and marks the chosen one', () => {
    const { fixture, host, openList } = setup();
    host.value.set('ACTIVE');
    fixture.detectChanges();
    const options = openList();
    expect(options.map(o => o.textContent!.trim())).toEqual(['전체', '대기중', '활성']);
    expect(options.map(o => o.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
  });

  it('emits the picked value, and null for 전체', () => {
    const { fixture, host, openList } = setup();
    openList()[1].click();
    fixture.detectChanges();
    openList()[0].click();
    expect(host.chosen).toEqual(['PENDING', null]);
  });

  it('does not emit when the chosen option is picked again', () => {
    const { openList, host } = setup();
    openList()[0].click();
    expect(host.chosen).toEqual([]);
  });
});
