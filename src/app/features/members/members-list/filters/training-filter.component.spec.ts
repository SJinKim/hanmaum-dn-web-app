import { TestBed } from '@angular/core/testing';
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import { SummaryTraining } from '../../../../core/models/member-activity.model';
import { TrainingFilterComponent } from './training-filter.component';

function makeParams(filterChangedCallback = (): void => {}): IFilterParams {
  return { filterChangedCallback } as unknown as IFilterParams;
}

function createComponent(): TrainingFilterComponent {
  TestBed.configureTestingModule({ imports: [TrainingFilterComponent] });
  return TestBed.createComponent(TrainingFilterComponent).componentInstance;
}

function passParams(trainings: SummaryTraining[]): IDoesFilterPassParams {
  const data = { trainings };
  return { data, node: { data } } as unknown as IDoesFilterPassParams;
}

const QTBS_ACTIVE: SummaryTraining = { name: 'QTBS', status: 'IN_PROGRESS' };
const QTBS_DONE: SummaryTraining = { name: 'QTBS', status: 'COMPLETED' };

describe('TrainingFilterComponent', () => {
  it('is inactive and passes everything by default', () => {
    const c = createComponent();
    c.agInit(makeParams());
    expect(c.isFilterActive()).toBe(false);
    expect(c.doesFilterPass(passParams([QTBS_DONE]))).toBe(true);
  });

  it('cycles a training off → IN_PROGRESS → COMPLETED → off', () => {
    const c = createComponent();
    c.agInit(makeParams());
    expect(c.stateOf('QTBS')).toBeUndefined();
    c.cycle('QTBS');
    expect(c.stateOf('QTBS')).toBe('IN_PROGRESS');
    c.cycle('QTBS');
    expect(c.stateOf('QTBS')).toBe('COMPLETED');
    c.cycle('QTBS');
    expect(c.stateOf('QTBS')).toBeUndefined();
  });

  it('first click matches only the in-progress training', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.cycle('QTBS'); // IN_PROGRESS
    expect(c.doesFilterPass(passParams([QTBS_ACTIVE]))).toBe(true);
    expect(c.doesFilterPass(passParams([QTBS_DONE]))).toBe(false);
  });

  it('second click matches only the completed training', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.cycle('QTBS');
    c.cycle('QTBS'); // COMPLETED
    expect(c.doesFilterPass(passParams([QTBS_DONE]))).toBe(true);
    expect(c.doesFilterPass(passParams([QTBS_ACTIVE]))).toBe(false);
  });

  it('(없음) matches members with no trainings', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.toggleNone();
    expect(c.isFilterActive()).toBe(true);
    expect(c.doesFilterPass(passParams([]))).toBe(true);
    expect(c.doesFilterPass(passParams([QTBS_ACTIVE]))).toBe(false);
  });

  it('ORs multiple selected states within the column', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.cycle('QTBS');                                  // QTBS in-progress
    c.cycle('1on1'); c.cycle('1on1');                 // 1on1 completed
    expect(c.doesFilterPass(passParams([QTBS_ACTIVE]))).toBe(true);
    expect(c.doesFilterPass(passParams([{ name: '1on1', status: 'COMPLETED' }]))).toBe(true);
    expect(c.doesFilterPass(passParams([{ name: '1on1', status: 'IN_PROGRESS' }]))).toBe(false);
  });

  it('builds a model from the current selection', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.cycle('QTBS');     // IN_PROGRESS
    c.toggleNone();
    expect(c.getModel()).toEqual({ none: true, states: { QTBS: 'IN_PROGRESS' } });
  });

  it('restores a selection from a model', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.setModel({ states: { '1on1': 'COMPLETED' } });
    expect(c.stateOf('1on1')).toBe('COMPLETED');
    expect(c.doesFilterPass(passParams([{ name: '1on1', status: 'COMPLETED' }]))).toBe(true);
  });
});
