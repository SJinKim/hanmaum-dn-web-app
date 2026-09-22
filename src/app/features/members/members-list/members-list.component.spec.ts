import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { MembersListComponent } from './members-list.component';
import { TrainingCatalogService } from '../../../core/services/training-catalog.service';
import { TrainingCatalogEntry } from '../../../core/models/member-activity.model';
import { MemberSummary } from '../../../core/models/member.model';

/** Three coded courses in catalog order plus one the stage rule knows nothing about. */
function catalogEntry(
  code: string,
  name: string,
  nameKo: string,
  sortOrder: number,
): TrainingCatalogEntry {
  return {
    publicId: `id-${code}`,
    code,
    name,
    nameKo,
    category: null,
    sortOrder,
    hasCohorts: false,
    isActive: true,
    prerequisiteCode: null,
  };
}

const CATALOG: TrainingCatalogEntry[] = [
  catalogEntry('QT_BASIC_SEMINAR', 'QT Basic Seminar', '큐베세', 1),
  catalogEntry('ONE_ON_ONE', 'One-to-One Discipleship Training', '일대일', 2),
  catalogEntry('YOUTH_POWER_DISCIPLESHIP', 'Youth Power Discipleship', '제자반', 3),
  catalogEntry('SUMMER_RETREAT', 'Summer Retreat', '여름수련회', 9),
];

function member(trainings: MemberSummary['trainings']): MemberSummary {
  return {
    publicId: 'm-1',
    lastName: '김',
    firstName: '청년',
    email: null,
    memberStatus: 'ACTIVE',
    baptism: 'GENERAL_BAPTIZED',
    groupName: null,
    trainings,
  };
}

describe('MembersListComponent — 양육 tags', () => {
  let component: MembersListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MembersListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { members: { stage: { none: 'None' } } }, true);
    translate.setTranslation('ko', { members: { stage: { none: '없음' } } }, true);
    translate.use('en');

    TestBed.inject(TrainingCatalogService).entries.set(CATALOG);
    component = TestBed.createComponent(MembersListComponent).componentInstance;
  });

  it('shows every completed course, in catalog order, not just the highest one', () => {
    const tags = component.trainingTags(
      member([
        { name: 'Youth Power Discipleship', status: 'COMPLETED' },
        { name: 'QT Basic Seminar', status: 'COMPLETED' },
      ]),
    );

    expect(tags).toEqual([
      { label: 'QT Basic Seminar', stage: 'qbs' },
      { label: 'Youth Power Discipleship', stage: 'discipleship' },
    ]);
  });

  it('ignores courses that are only in progress and falls back to 없음', () => {
    const tags = component.trainingTags(
      member([{ name: 'One-to-One Discipleship Training', status: 'IN_PROGRESS' }]),
    );

    expect(tags).toEqual([{ label: 'None', stage: 'none' }]);
  });

  it('renders 없음 for a member without any training at all', () => {
    expect(component.trainingTags(member(undefined))).toEqual([{ label: 'None', stage: 'none' }]);
  });

  it('gives a course outside the three stages a neutral pill, sorted by the catalog', () => {
    const tags = component.trainingTags(
      member([
        { name: 'Summer Retreat', status: 'COMPLETED' },
        { name: 'QT Basic Seminar', status: 'COMPLETED' },
      ]),
    );

    expect(tags).toEqual([
      { label: 'QT Basic Seminar', stage: 'qbs' },
      { label: 'Summer Retreat', stage: 'none' },
    ]);
  });

  it('switches the tag labels to the Korean catalog names with the UI language', () => {
    TestBed.inject(TranslateService).use('ko');

    const tags = component.trainingTags(
      member([{ name: 'Youth Power Discipleship', status: 'COMPLETED' }]),
    );

    expect(tags).toEqual([{ label: '제자반', stage: 'discipleship' }]);
  });
});
