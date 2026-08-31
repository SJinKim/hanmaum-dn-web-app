import {
  TrainingCatalogEntry,
  UserTraining,
  catalogEntryByCode,
  catalogEntryByName,
  completedAtFromMonthYear,
  mapFormValueToItem,
  mapUserTrainingToFormValue,
  monthYearFromCompletedAt,
  trainingLabelForName,
  trainingOptions,
  trainingStatusGroup,
} from './member-activity.model';

function entry(over: Partial<TrainingCatalogEntry> & { code: string; name: string }): TrainingCatalogEntry {
  return {
    publicId: `p-${over.code}`,
    nameKo: `${over.code}-ko`,
    category: null,
    sortOrder: 1,
    hasCohorts: false,
    isActive: true,
    prerequisiteCode: null,
    ...over,
  };
}

const CATALOG: TrainingCatalogEntry[] = [
  entry({ code: 'QT_BASIC_SEMINAR', name: 'Quiet Time Basic Seminar', nameKo: '큐티베이직세미나', sortOrder: 1 }),
  entry({ code: 'ONE_ON_ONE', name: 'One-to-One Discipleship Training', nameKo: '일대일제자양육', sortOrder: 2 }),
  entry({ code: 'YOUTH_POWER_DISCIPLESHIP', name: 'Youth Power Discipleship Class', nameKo: '청년 파워제자반', sortOrder: 3 }),
  entry({ code: 'KAIROS', name: 'Kairos', nameKo: '카이로스', sortOrder: 9, isActive: false }),
];

describe('member-activity.model — training status', () => {
  it('groups the running statuses as ACTIVE', () => {
    expect(trainingStatusGroup('APPLIED')).toBe('ACTIVE');
    expect(trainingStatusGroup('ENROLLED')).toBe('ACTIVE');
    expect(trainingStatusGroup('IN_PROGRESS')).toBe('ACTIVE');
  });

  it('groups COMPLETED on its own and the terminal statuses as INACTIVE', () => {
    expect(trainingStatusGroup('COMPLETED')).toBe('COMPLETED');
    expect(trainingStatusGroup('DROPPED')).toBe('INACTIVE');
    expect(trainingStatusGroup('UNKNOWN')).toBe('INACTIVE');
  });
});

describe('member-activity.model — catalog lookups', () => {
  it('finds an entry by code and by the DTO name', () => {
    expect(catalogEntryByCode(CATALOG, 'ONE_ON_ONE')?.publicId).toBe('p-ONE_ON_ONE');
    expect(catalogEntryByName(CATALOG, 'One-to-One Discipleship Training')?.code).toBe('ONE_ON_ONE');
  });

  it('returns undefined for an unknown or empty key', () => {
    expect(catalogEntryByCode(CATALOG, 'NOPE')).toBeUndefined();
    expect(catalogEntryByName(CATALOG, null)).toBeUndefined();
  });

  it('labels a training in the active language', () => {
    expect(trainingLabelForName(CATALOG, 'Quiet Time Basic Seminar', 'ko')).toBe('큐티베이직세미나');
    expect(trainingLabelForName(CATALOG, 'Quiet Time Basic Seminar', 'en')).toBe('Quiet Time Basic Seminar');
  });

  it('falls back to the raw name when the catalog does not know it', () => {
    expect(trainingLabelForName(CATALOG, 'Brand New Course', 'ko')).toBe('Brand New Course');
    expect(trainingLabelForName([], 'Quiet Time Basic Seminar', 'ko')).toBe('Quiet Time Basic Seminar');
  });

  it('offers only active courses, in catalog order', () => {
    expect(trainingOptions(CATALOG, 'en').map(o => o.value)).toEqual([
      'QT_BASIC_SEMINAR',
      'ONE_ON_ONE',
      'YOUTH_POWER_DISCIPLESHIP',
    ]);
  });

  it('keeps a retired course that the member still holds', () => {
    expect(trainingOptions(CATALOG, 'en', ['KAIROS']).map(o => o.value)).toContain('KAIROS');
  });
});

describe('member-activity.model — training mapping', () => {
  describe('completedAtFromMonthYear', () => {
    it('pins to the first of the month as an ISO date', () => {
      expect(completedAtFromMonthYear(3, 2022)).toBe('2022-03-01');
      expect(completedAtFromMonthYear(12, 2030)).toBe('2030-12-01');
    });

    it('returns null when month or year is missing', () => {
      expect(completedAtFromMonthYear(null, 2022)).toBeNull();
      expect(completedAtFromMonthYear(3, null)).toBeNull();
      expect(completedAtFromMonthYear(null, null)).toBeNull();
    });
  });

  describe('monthYearFromCompletedAt', () => {
    it('splits an ISO date into month + year', () => {
      expect(monthYearFromCompletedAt('2022-03-01')).toEqual({ month: 3, year: 2022 });
    });

    it('returns nulls for a null date', () => {
      expect(monthYearFromCompletedAt(null)).toEqual({ month: null, year: null });
    });
  });

  describe('mapUserTrainingToFormValue', () => {
    it('maps a completed backend training to a form value', () => {
      const ut: UserTraining = {
        trainingPublicId: 'p-ONE_ON_ONE',
        name: 'One-to-One Discipleship Training',
        status: 'COMPLETED',
        completedAt: '2023-05-01',
      };
      expect(mapUserTrainingToFormValue(ut, CATALOG)).toEqual({
        code: 'ONE_ON_ONE',
        month: 5,
        year: 2023,
        status: 'COMPLETED',
      });
    });

    it('keeps every non-completed status instead of collapsing it', () => {
      const ut: UserTraining = {
        trainingPublicId: 'p-QT_BASIC_SEMINAR',
        name: 'Quiet Time Basic Seminar',
        status: 'APPLIED',
        completedAt: null,
      };
      expect(mapUserTrainingToFormValue(ut, CATALOG)).toEqual({
        code: 'QT_BASIC_SEMINAR',
        month: null,
        year: null,
        status: 'APPLIED',
      });
    });

    it('returns null when the catalog does not know the course', () => {
      const ut: UserTraining = {
        trainingPublicId: 'p-x',
        name: 'Brand New Course',
        status: 'COMPLETED',
        completedAt: '2023-05-01',
      };
      expect(mapUserTrainingToFormValue(ut, CATALOG)).toBeNull();
    });
  });

  describe('mapFormValueToItem', () => {
    it('resolves the course code to its catalog publicId', () => {
      expect(
        mapFormValueToItem({ code: 'QT_BASIC_SEMINAR', month: 5, year: 2023, status: 'COMPLETED' }, CATALOG),
      ).toEqual({ trainingPublicId: 'p-QT_BASIC_SEMINAR', status: 'COMPLETED', completedAt: '2023-05-01' });
    });

    it('drops the completion date for a course that is not completed', () => {
      expect(
        mapFormValueToItem({ code: 'ONE_ON_ONE', month: 5, year: 2023, status: 'ENROLLED' }, CATALOG),
      ).toEqual({ trainingPublicId: 'p-ONE_ON_ONE', status: 'ENROLLED', completedAt: null });
    });

    it('returns null without a code, or when the catalog is empty', () => {
      expect(
        mapFormValueToItem({ code: null, month: 5, year: 2023, status: 'COMPLETED' }, CATALOG),
      ).toBeNull();
      expect(
        mapFormValueToItem({ code: 'QT_BASIC_SEMINAR', month: 5, year: 2023, status: 'COMPLETED' }, []),
      ).toBeNull();
    });
  });
});
