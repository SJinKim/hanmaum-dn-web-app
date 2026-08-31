import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import {
  SummaryTraining,
  TrainingCatalogEntry,
} from '../../../../core/models/member-activity.model';
import { TrainingCatalogService } from '../../../../core/services/training-catalog.service';
import { TrainingFilterComponent } from './training-filter.component';

function entry(code: string, name: string, sortOrder: number, isActive = true): TrainingCatalogEntry {
  return {
    publicId: `p-${code}`, code, name, nameKo: `${code}-ko`,
    category: null, sortOrder, hasCohorts: false, isActive, prerequisiteCode: null,
  };
}

const CATALOG: TrainingCatalogEntry[] = [
  entry('QT_BASIC_SEMINAR', 'Quiet Time Basic Seminar', 1),
  entry('ONE_ON_ONE', 'One-to-One Discipleship Training', 2),
  entry('YOUTH_POWER_DISCIPLESHIP', 'Youth Power Discipleship Class', 3),
  entry('KAIROS', 'Kairos', 9, false),
];

function makeParams(filterChangedCallback = (): void => undefined): IFilterParams {
  return { filterChangedCallback } as unknown as IFilterParams;
}

function createComponent(catalog: TrainingCatalogEntry[] = CATALOG): TrainingFilterComponent {
  TestBed.configureTestingModule({
    imports: [TrainingFilterComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTranslateService({ fallbackLang: 'en' }),
    ],
  });
  TestBed.inject(TrainingCatalogService).entries.set(catalog);
  return TestBed.createComponent(TrainingFilterComponent).componentInstance;
}

function passParams(trainings: SummaryTraining[]): IDoesFilterPassParams {
  const data = { trainings };
  return { data, node: { data } } as unknown as IDoesFilterPassParams;
}

const QTBS = 'QT_BASIC_SEMINAR';
const QTBS_NAME = 'Quiet Time Basic Seminar';
const ONE_ON_ONE_NAME = 'One-to-One Discipleship Training';

const QTBS_ACTIVE: SummaryTraining = { name: QTBS_NAME, status: 'IN_PROGRESS' };
const QTBS_DONE: SummaryTraining = { name: QTBS_NAME, status: 'COMPLETED' };
const QTBS_DROPPED: SummaryTraining = { name: QTBS_NAME, status: 'DROPPED' };

describe('TrainingFilterComponent', () => {
  it('lists the active catalog courses in catalog order', () => {
    const c = createComponent();
    c.agInit(makeParams());
    expect(c.trainings().map(t => t.value)).toEqual([
      'QT_BASIC_SEMINAR',
      'ONE_ON_ONE',
      'YOUTH_POWER_DISCIPLESHIP',
    ]);
  });

  it('is inactive and passes everything by default', () => {
    const c = createComponent();
    c.agInit(makeParams());
    expect(c.isFilterActive()).toBe(false);
    expect(c.doesFilterPass(passParams([QTBS_DONE]))).toBe(true);
  });

  it('cycles a course off → ACTIVE → COMPLETED → INACTIVE → off', () => {
    const c = createComponent();
    c.agInit(makeParams());
    expect(c.stateOf(QTBS)).toBeUndefined();
    c.cycle(QTBS);
    expect(c.stateOf(QTBS)).toBe('ACTIVE');
    c.cycle(QTBS);
    expect(c.stateOf(QTBS)).toBe('COMPLETED');
    c.cycle(QTBS);
    expect(c.stateOf(QTBS)).toBe('INACTIVE');
    c.cycle(QTBS);
    expect(c.stateOf(QTBS)).toBeUndefined();
  });

  it('first click matches every running status, not just IN_PROGRESS', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.cycle(QTBS); // ACTIVE
    expect(c.doesFilterPass(passParams([QTBS_ACTIVE]))).toBe(true);
    expect(c.doesFilterPass(passParams([{ name: QTBS_NAME, status: 'APPLIED' }]))).toBe(true);
    expect(c.doesFilterPass(passParams([{ name: QTBS_NAME, status: 'ENROLLED' }]))).toBe(true);
    expect(c.doesFilterPass(passParams([QTBS_DONE]))).toBe(false);
  });

  it('second click matches only the completed course', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.cycle(QTBS);
    c.cycle(QTBS); // COMPLETED
    expect(c.doesFilterPass(passParams([QTBS_DONE]))).toBe(true);
    expect(c.doesFilterPass(passParams([QTBS_ACTIVE]))).toBe(false);
  });

  it('third click matches the dropped course', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.cycle(QTBS);
    c.cycle(QTBS);
    c.cycle(QTBS); // INACTIVE
    expect(c.doesFilterPass(passParams([QTBS_DROPPED]))).toBe(true);
    expect(c.doesFilterPass(passParams([QTBS_DONE]))).toBe(false);
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
    c.cycle(QTBS);                                     // QTBS running
    c.cycle('ONE_ON_ONE'); c.cycle('ONE_ON_ONE');      // 1on1 completed
    expect(c.doesFilterPass(passParams([QTBS_ACTIVE]))).toBe(true);
    expect(c.doesFilterPass(passParams([{ name: ONE_ON_ONE_NAME, status: 'COMPLETED' }]))).toBe(true);
    expect(c.doesFilterPass(passParams([{ name: ONE_ON_ONE_NAME, status: 'IN_PROGRESS' }]))).toBe(false);
  });

  it('does not confuse two courses whose names overlap', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.cycle('YOUTH_POWER_DISCIPLESHIP');
    c.cycle('YOUTH_POWER_DISCIPLESHIP'); // COMPLETED
    // "One-to-One Discipleship Training" also contains "Discipleship".
    expect(c.doesFilterPass(passParams([{ name: ONE_ON_ONE_NAME, status: 'COMPLETED' }]))).toBe(false);
    expect(c.doesFilterPass(passParams([
      { name: 'Youth Power Discipleship Class', status: 'COMPLETED' },
    ]))).toBe(true);
  });

  it('builds a model from the current selection', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.cycle(QTBS);
    c.toggleNone();
    expect(c.getModel()).toEqual({ none: true, states: { QT_BASIC_SEMINAR: 'ACTIVE' } });
  });

  it('restores a selection from a model', () => {
    const c = createComponent();
    c.agInit(makeParams());
    c.setModel({ states: { ONE_ON_ONE: 'COMPLETED' } });
    expect(c.stateOf('ONE_ON_ONE')).toBe('COMPLETED');
    expect(c.doesFilterPass(passParams([{ name: ONE_ON_ONE_NAME, status: 'COMPLETED' }]))).toBe(true);
  });
});
