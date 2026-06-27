import { TestBed } from '@angular/core/testing';
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import {
  SetFilterComponent,
  SetFilterOption,
  SetFilterParams,
  NULL_TOKEN,
} from './set-filter.component';

interface Row {
  status?: string | null;
  tags?: string[];
}

function makeParams(
  config: SetFilterParams,
  filterChangedCallback = (): void => {},
): IFilterParams & SetFilterParams {
  return {
    filterChangedCallback,
    options: config.options,
    optionValues: config.optionValues,
  } as unknown as IFilterParams & SetFilterParams;
}

function createComponent(): SetFilterComponent {
  TestBed.configureTestingModule({ imports: [SetFilterComponent] });
  return TestBed.createComponent(SetFilterComponent).componentInstance;
}

function passParams(data: Row): IDoesFilterPassParams {
  return { data, node: { data } } as unknown as IDoesFilterPassParams;
}

describe('SetFilterComponent', () => {
  const statusOptions: SetFilterOption[] = [
    { token: 'PENDING', label: '대기중' },
    { token: 'ACTIVE', label: '활성' },
    { token: 'INACTIVE', label: '비활성' },
  ];
  const statusConfig: SetFilterParams = {
    options: () => statusOptions,
    optionValues: (d: unknown) => [(d as Row).status],
  };

  it('renders the provided options in order, regardless of the rows', () => {
    const c = createComponent();
    c.agInit(makeParams(statusConfig));
    expect(c.filteredOptions().map(o => o.label)).toEqual(['대기중', '활성', '비활성']);
  });

  it('is inactive and passes every row when nothing is selected', () => {
    const c = createComponent();
    c.agInit(makeParams(statusConfig));
    expect(c.isFilterActive()).toBe(false);
    expect(c.doesFilterPass(passParams({ status: 'ACTIVE' }))).toBe(true);
  });

  it('passes only selected values once a box is checked', () => {
    const c = createComponent();
    c.agInit(makeParams(statusConfig));
    c.toggle('ACTIVE');
    expect(c.isFilterActive()).toBe(true);
    expect(c.doesFilterPass(passParams({ status: 'ACTIVE' }))).toBe(true);
    expect(c.doesFilterPass(passParams({ status: 'PENDING' }))).toBe(false);
  });

  describe('multi-value column with null bucket', () => {
    const config: SetFilterParams = {
      options: () => [
        { token: '찬양팀', label: '찬양팀' },
        { token: '미디어팀', label: '미디어팀' },
        { token: NULL_TOKEN, label: '(없음)' },
      ],
      optionValues: (d: unknown) => (d as Row).tags ?? [],
    };

    it('passes a row when any of its values is selected', () => {
      const c = createComponent();
      c.agInit(makeParams(config));
      c.toggle('미디어팀');
      expect(c.doesFilterPass(passParams({ tags: ['찬양팀', '미디어팀'] }))).toBe(true);
      expect(c.doesFilterPass(passParams({ tags: ['찬양팀'] }))).toBe(false);
    });

    it('matches empty rows when the null option is selected', () => {
      const c = createComponent();
      c.agInit(makeParams(config));
      c.toggle(NULL_TOKEN);
      expect(c.doesFilterPass(passParams({ tags: [] }))).toBe(true);
      expect(c.doesFilterPass(passParams({ tags: ['찬양팀'] }))).toBe(false);
    });
  });

  it('narrows visible options by label via the search box', () => {
    const c = createComponent();
    c.agInit(makeParams(statusConfig));
    c.searchText = '대기';
    expect(c.filteredOptions().map(o => o.label)).toEqual(['대기중']);
  });

  describe('model round-trip', () => {
    it('returns null when empty and the selected values otherwise', () => {
      const c = createComponent();
      c.agInit(makeParams(statusConfig));
      expect(c.getModel()).toBeNull();
      c.toggle('ACTIVE');
      expect(c.getModel()).toEqual({ values: ['ACTIVE'] });
    });

    it('restores selection from a model (deep-link / restore)', () => {
      const c = createComponent();
      c.agInit(makeParams(statusConfig));
      c.setModel({ values: ['PENDING'] });
      expect(c.isFilterActive()).toBe(true);
      expect(c.doesFilterPass(passParams({ status: 'PENDING' }))).toBe(true);
      expect(c.doesFilterPass(passParams({ status: 'ACTIVE' }))).toBe(false);
    });
  });

  it('notifies the grid when a selection changes', () => {
    const spy = jasmine.createSpy('filterChangedCallback');
    const c = createComponent();
    c.agInit(makeParams(statusConfig, spy));
    c.toggle('ACTIVE');
    c.clear();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
