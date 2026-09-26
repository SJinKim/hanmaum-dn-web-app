import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { MembersListComponent } from './members-list.component';
import { TrainingCatalogService } from '../../../core/services/training-catalog.service';
import { TrainingCatalogEntry } from '../../../core/models/member-activity.model';
import { MemberSummary } from '../../../core/models/member.model';
import { MemberService, UNASSIGNED_GROUP } from '../member.service';
import { BreakpointService } from '../../../core/ui/breakpoint.service';

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

// #78: 상태 is one select like 세례, and it keeps what the four chips did — the
// 대기중 count and the Home deep link `/members?status=PENDING`.
describe('MembersListComponent — 상태 select', () => {
  function setup(queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [MembersListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap(queryParams)) } },
      ],
    });

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      members: {
        filters: { status: 'Status', statusAll: 'All statuses', baptismAll: 'All baptisms' },
        status: { PENDING: 'Pending', ACTIVE: 'Active', INACTIVE: 'Inactive', DELETED: 'Deleted' },
      },
    }, true);
    translate.use('en');

    const fixture = TestBed.createComponent(MembersListComponent);
    return { fixture, component: fixture.componentInstance, service: TestBed.inject(MemberService) };
  }

  it('lists 전체 first, then the statuses in the Figma order with the 대기중 count', () => {
    const { component, service } = setup();
    service.pendingCount.set(3);

    expect(component.statusOptions()).toEqual([
      { label: 'All statuses', value: null },
      { label: 'Pending (3)', value: 'PENDING' },
      { label: 'Active', value: 'ACTIVE' },
      { label: 'Inactive', value: 'INACTIVE' },
      { label: 'Deleted', value: 'DELETED' },
    ]);
  });

  it('updates the 대기중 label when the count is refreshed', () => {
    const { component, service } = setup();
    service.pendingCount.set(3);
    expect(component.statusOptions()[1].label).toBe('Pending (3)');

    service.pendingCount.set(2);
    expect(component.statusOptions()[1].label).toBe('Pending (2)');
  });

  it('writes the chosen status to the service, and 전체 clears it', () => {
    const { component, service } = setup();
    const setStatus = spyOn(service, 'setStatus');

    component.onStatusChange('INACTIVE');
    component.onStatusChange(null);

    expect(setStatus.calls.allArgs()).toEqual([['INACTIVE'], [null]]);
  });

  it('renders no 상태 chips any more', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('app-filter-chip'))).toBeNull();
  });

  it('shows 대기중 selected after the Home deep link', async () => {
    const { fixture, service } = setup({ status: 'PENDING' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.status()).toBe('PENDING');
    const statusSelect = fixture.debugElement
      .queryAll(By.css('p-select'))
      .find(select => select.componentInstance.ariaLabel === 'Status')!;
    expect(statusSelect.nativeElement.textContent).toContain('Pending (0)');
  });
});

// #79: one select per column except 이름 — 순, 양육 and 사역 join 상태 and 세례.
describe('MembersListComponent — 순/양육/사역 selects', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [MembersListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
      ],
    });

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      members: {
        unassigned: 'Unassigned',
        filters: { groupAll: 'All groups', trainingAll: 'All trainings', ministryAll: 'All ministries' },
      },
    }, true);
    translate.use('en');

    const fixture = TestBed.createComponent(MembersListComponent);
    return {
      fixture,
      component: fixture.componentInstance,
      service: TestBed.inject(MemberService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  function ok<T>(data: T) {
    return { success: true, message: null, data };
  }

  it('offers 전체, then 미배정, then every group', () => {
    const { fixture, component, http } = setup();
    fixture.detectChanges();
    http
      .expectOne(r => r.url.endsWith('/v1/church-groups'))
      .flush(ok([{ publicId: 'g-1', name: '1순' }, { publicId: 'g-2', name: '2순' }]));

    expect(component.groupFilterOptions()).toEqual([
      { label: 'All groups', value: null },
      { label: 'Unassigned', value: UNASSIGNED_GROUP },
      { label: '1순', value: 'g-1' },
      { label: '2순', value: 'g-2' },
    ]);
  });

  it('offers every course in catalog order, retired ones included, by code', () => {
    const { component } = setup();
    const retired = { ...catalogEntry('OLD_COURSE', 'Old Course', '옛 과정', 0), isActive: false };
    TestBed.inject(TrainingCatalogService).entries.set([CATALOG[1], retired, CATALOG[0]]);

    expect(component.trainingFilterOptions()).toEqual([
      { label: 'All trainings', value: null },
      { label: 'Old Course', value: 'OLD_COURSE' },
      { label: 'QT Basic Seminar', value: 'QT_BASIC_SEMINAR' },
      { label: 'One-to-One Discipleship Training', value: 'ONE_ON_ONE' },
    ]);
  });

  it('offers the active ministries from the catalog', () => {
    const { fixture, component, http } = setup();
    fixture.detectChanges();
    const req = http.expectOne(r => r.url.endsWith('/v1/ministries'));
    expect(req.request.params.get('active')).toBe('true');
    req.flush(ok([{ publicId: 'min-1', title: '찬양팀' }]));

    expect(component.ministryFilterOptions()).toEqual([
      { label: 'All ministries', value: null },
      { label: '찬양팀', value: 'min-1' },
    ]);
  });

  it('writes each choice to the service', () => {
    const { component, service } = setup();
    const setGroup = spyOn(service, 'setGroup');
    const setTraining = spyOn(service, 'setTraining');
    const setMinistry = spyOn(service, 'setMinistry');

    component.onGroupChange(UNASSIGNED_GROUP);
    component.onTrainingChange('ONE_ON_ONE');
    component.onMinistryChange(null);

    expect(setGroup).toHaveBeenCalledWith(UNASSIGNED_GROUP);
    expect(setTraining).toHaveBeenCalledWith('ONE_ON_ONE');
    expect(setMinistry).toHaveBeenCalledWith(null);
  });

  it('counts 순, 양육 and 사역 as filters for the 결과 없음 state', () => {
    const { component, service } = setup();
    expect(component.filtered()).toBeFalse();

    for (const pick of [
      () => service.group.set(UNASSIGNED_GROUP),
      () => service.training.set('ONE_ON_ONE'),
      () => service.ministry.set('min-1'),
    ]) {
      service.group.set(null);
      service.training.set(null);
      service.ministry.set(null);
      pick();
      expect(component.filtered()).toBeTrue();
    }
  });

  it('writes the 최근 활동 range as local ISO days (#88)', () => {
    const { component, service } = setup();
    const setFrom = spyOn(service, 'setUpdatedFrom');
    const setTo = spyOn(service, 'setUpdatedTo');

    component.onUpdatedFromChange(new Date(2026, 8, 1));
    component.onUpdatedToChange(null);

    expect(setFrom).toHaveBeenCalledWith('2026-09-01');
    expect(setTo).toHaveBeenCalledWith(null);
  });

  it('shows the range as Dates and counts it as a filter', () => {
    const { component, service } = setup();
    service.updatedTo.set('2026-09-26');

    expect(component.updatedTo()).toEqual(new Date(2026, 8, 26));
    expect(component.updatedFrom()).toBeNull();
    expect(component.filtered()).toBeTrue();
  });

  it('renders the 최근 활동 range with two pickers', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('[data-testid="updated-range"] p-datepicker')).length).toBe(2);
  });

  it('renders five filter selects', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('p-select[appFilters]')).length).toBe(5);
  });
});

// #68: 이름, 상태, 순 and 세례 are sort buttons; 양육, 사역 and 최근 활동 stay plain.
describe('MembersListComponent — sortable headers', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [MembersListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        // ChromeHeadless opens at 800px, below the 834px table breakpoint.
        { provide: BreakpointService, useValue: { isPhone: signal(false) } },
      ],
    });

    const fixture = TestBed.createComponent(MembersListComponent);
    const service = TestBed.inject(MemberService);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    // The table renders only once the first page is in.
    http.match(r => r.url.endsWith('/v1/members')).forEach(req =>
      req.flush({
        success: true,
        message: null,
        data: { content: [member(undefined)], totalElements: 1, totalPages: 1, number: 0, size: 20 },
      }),
    );
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, service };
  }

  function headers(fixture: ReturnType<typeof setup>['fixture']) {
    return fixture.debugElement.queryAll(By.css('thead th'));
  }

  it('puts a sort button on exactly the 이름, 상태, 순 and 세례 headers', () => {
    const { fixture } = setup();
    const sortable = headers(fixture).map(th => th.query(By.css('button')) !== null);

    // 이름, 상태, 순, 양육, 사역, 세례, 최근 활동
    expect(sortable.slice(0, 7)).toEqual([true, true, true, false, false, true, false]);
  });

  it('sends the column property to the service on click', () => {
    const { fixture, service } = setup();
    const toggleSort = spyOn(service, 'toggleSort');

    headers(fixture)[5].query(By.css('button')).nativeElement.click();

    expect(toggleSort).toHaveBeenCalledWith('baptism');
  });

  it('marks only the sorted header with aria-sort and a direction icon', () => {
    const { fixture, service } = setup();
    service.sort.set({ property: 'groupName', direction: 'desc' });
    fixture.detectChanges();

    const ths = headers(fixture);
    expect(ths[2].attributes['aria-sort']).toBe('descending');
    expect(ths[2].query(By.css('i')).nativeElement.className).toContain('pi-sort-amount-down');
    expect(ths[0].attributes['aria-sort']).toBe('none');
    expect(ths[0].query(By.css('i')).nativeElement.className).toContain('pi-sort-alt');
    expect(ths[3].attributes['aria-sort']).toBeUndefined();

    service.sort.set({ property: 'groupName', direction: 'asc' });
    fixture.detectChanges();
    expect(ths[2].attributes['aria-sort']).toBe('ascending');
  });
});
