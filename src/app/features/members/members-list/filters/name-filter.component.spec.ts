import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import { MemberSummary } from '../../../../core/models/member.model';
import { NameFilterComponent } from './name-filter.component';

function makeParams(filterChangedCallback: () => void): IFilterParams {
  return { filterChangedCallback } as unknown as IFilterParams;
}

function createComponent(): NameFilterComponent {
  TestBed.configureTestingModule({
    imports: [NameFilterComponent],
    providers: [provideTranslateService({ fallbackLang: 'en' })],
  });
  return TestBed.createComponent(NameFilterComponent).componentInstance;
}

function passParams(data: Partial<MemberSummary>): IDoesFilterPassParams<MemberSummary> {
  return { data: data as MemberSummary, node: { data } } as unknown as IDoesFilterPassParams<MemberSummary>;
}

describe('NameFilterComponent', () => {
  let component: NameFilterComponent;
  let changed: jasmine.Spy;

  beforeEach(() => {
    changed = jasmine.createSpy('filterChangedCallback');
    component = createComponent();
    component.agInit(makeParams(changed));
  });

  it('is inactive when text is empty and the 순장 checkbox is off', () => {
    expect(component.isFilterActive()).toBeFalse();
    expect(component.getModel()).toBeNull();
  });

  it('passes every row when inactive', () => {
    expect(component.doesFilterPass(passParams({ lastName: '김', firstName: '철수' }))).toBeTrue();
    expect(component.doesFilterPass(passParams({ lastName: '이', firstName: '영희', isGroupLeader: true }))).toBeTrue();
  });

  it('filters by name substring (case-insensitive)', () => {
    component.searchText = '영희';
    expect(component.doesFilterPass(passParams({ lastName: '이', firstName: '영희' }))).toBeTrue();
    expect(component.doesFilterPass(passParams({ lastName: '김', firstName: '철수' }))).toBeFalse();
  });

  it('filters to group leaders when the checkbox is on', () => {
    component.groupLeaderOnly = true;
    expect(component.doesFilterPass(passParams({ lastName: '김', firstName: '철수', isGroupLeader: true }))).toBeTrue();
    expect(component.doesFilterPass(passParams({ lastName: '이', firstName: '영희' }))).toBeFalse();
  });

  it('ANDs text search with the 순장 checkbox', () => {
    component.searchText = '김';
    component.groupLeaderOnly = true;
    expect(component.doesFilterPass(passParams({ lastName: '김', firstName: '철수', isGroupLeader: true }))).toBeTrue();
    expect(component.doesFilterPass(passParams({ lastName: '김', firstName: '영희' }))).toBeFalse();
    expect(component.doesFilterPass(passParams({ lastName: '이', firstName: '영희', isGroupLeader: true }))).toBeFalse();
  });

  it('toggleGroupLeader flips the flag and notifies the grid', () => {
    component.toggleGroupLeader();
    expect(component.groupLeaderOnly).toBeTrue();
    expect(component.isFilterActive()).toBeTrue();
    expect(changed).toHaveBeenCalled();
  });

  it('clear resets both fields and notifies the grid', () => {
    component.searchText = '김';
    component.groupLeaderOnly = true;
    component.clear();
    expect(component.searchText).toBe('');
    expect(component.groupLeaderOnly).toBeFalse();
    expect(component.isFilterActive()).toBeFalse();
    expect(changed).toHaveBeenCalled();
  });

  it('round-trips the model', () => {
    component.setModel({ text: '김', groupLeaderOnly: true });
    expect(component.searchText).toBe('김');
    expect(component.groupLeaderOnly).toBeTrue();
    expect(component.getModel()).toEqual({ text: '김', groupLeaderOnly: true });
  });
});
