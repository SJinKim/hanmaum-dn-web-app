import {
  TrainingCatalogEntry,
  UserTraining,
  trainingTypeForName,
  trainingPublicIdForType,
  completedAtFromMonthYear,
  monthYearFromCompletedAt,
  mapUserTrainingToFormValue,
  mapFormValueToItem,
} from './member-activity.model';

const CATALOG: TrainingCatalogEntry[] = [
  { publicId: 'p-qtbs', name: 'QTBS', sortOrder: 1 },
  { publicId: 'p-1on1', name: '1on1', sortOrder: 2 },
  { publicId: 'p-disc', name: 'Discipleship', sortOrder: 3 },
];

describe('member-activity.model — training mapping', () => {
  describe('trainingTypeForName', () => {
    it('resolves catalog names back to the form enum', () => {
      expect(trainingTypeForName('QTBS')).toBe('QTBS');
      expect(trainingTypeForName('1on1')).toBe('ONE_ON_ONE');
      expect(trainingTypeForName('Discipleship')).toBe('DISCIPLESHIP');
    });

    it('returns null for an unknown name', () => {
      expect(trainingTypeForName('Unknown')).toBeNull();
    });
  });

  describe('trainingPublicIdForType', () => {
    it('finds the catalog publicId for a form type', () => {
      expect(trainingPublicIdForType('ONE_ON_ONE', CATALOG)).toBe('p-1on1');
      expect(trainingPublicIdForType('QTBS', CATALOG)).toBe('p-qtbs');
    });

    it('returns null when the type is absent from the catalog', () => {
      expect(trainingPublicIdForType('DISCIPLESHIP', [])).toBeNull();
    });
  });

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
        trainingPublicId: 'p-1on1',
        name: '1on1',
        status: 'COMPLETED',
        completedAt: '2022-03-01',
      };
      expect(mapUserTrainingToFormValue(ut)).toEqual({
        type: 'ONE_ON_ONE',
        month: 3,
        year: 2022,
        status: 'COMPLETED',
      });
    });

    it('maps an in-progress training (no completed date) to a form value', () => {
      const ut: UserTraining = {
        trainingPublicId: 'p-qtbs',
        name: 'QTBS',
        status: 'IN_PROGRESS',
        completedAt: null,
      };
      expect(mapUserTrainingToFormValue(ut)).toEqual({
        type: 'QTBS',
        month: null,
        year: null,
        status: 'IN_PROGRESS',
      });
    });

    it('returns null when the training name is not in the catalog enum', () => {
      const ut: UserTraining = {
        trainingPublicId: 'p-x',
        name: 'Mystery',
        status: 'COMPLETED',
        completedAt: '2022-03-01',
      };
      expect(mapUserTrainingToFormValue(ut)).toBeNull();
    });
  });

  describe('mapFormValueToItem', () => {
    it('maps a completed form value to a PUT item', () => {
      expect(
        mapFormValueToItem({ type: 'QTBS', month: 5, year: 2023, status: 'COMPLETED' }, CATALOG),
      ).toEqual({ trainingPublicId: 'p-qtbs', status: 'COMPLETED', completedAt: '2023-05-01' });
    });

    it('drops the completed date for an in-progress item', () => {
      expect(
        mapFormValueToItem({ type: 'DISCIPLESHIP', month: 5, year: 2023, status: 'IN_PROGRESS' }, CATALOG),
      ).toEqual({ trainingPublicId: 'p-disc', status: 'IN_PROGRESS', completedAt: null });
    });

    it('returns null when type is missing', () => {
      expect(
        mapFormValueToItem({ type: null, month: 5, year: 2023, status: 'COMPLETED' }, CATALOG),
      ).toBeNull();
    });

    it('returns null when the type has no catalog entry', () => {
      expect(
        mapFormValueToItem({ type: 'QTBS', month: 5, year: 2023, status: 'COMPLETED' }, []),
      ).toBeNull();
    });
  });
});
