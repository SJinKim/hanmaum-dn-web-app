import {
  DataColumn,
  DataRecord,
  asBadge,
  asProgress,
  cellText,
  cellValue,
  columnId,
  columnSortField,
  columnTone,
} from './data-record.model';

const record: DataRecord = {
  id: 'm-1',
  title: '김승진',
  subtitle: '1순',
  badge: { variant: 'active', label: '활동' },
  meta: '2024-03-12',
  progress: { value: 72, label: '72%' },
  cells: {
    role: { variant: 'group-leader', label: '순장' },
    attended: 8,
    ratio: { value: 80, label: '80%' },
    empty: null,
  },
};

describe('DataColumn definition (#69)', () => {
  describe('cellValue', () => {
    it('reads the named field for an unkeyed column', () => {
      expect(cellValue(record, { type: 'avatar-name', header: '이름' })).toBe('김승진');
      expect(cellValue(record, { type: 'text', header: '순' })).toBe('1순');
      expect(cellValue(record, { type: 'badge', header: '상태' })).toEqual(record.badge);
      expect(cellValue(record, { type: 'date', header: '등록일' })).toBe('2024-03-12');
      expect(cellValue(record, { type: 'progress', header: '훈련' })).toEqual(record.progress);
    });

    it('reads cells[key] for a keyed column', () => {
      expect(cellValue(record, { type: 'badge', key: 'role', header: '역할' })).toEqual(record.cells!['role']);
      expect(cellValue(record, { type: 'text', key: 'attended', header: '참석' })).toBe(8);
      expect(cellValue(record, { type: 'text', key: 'missing', header: '없음' })).toBeUndefined();
    });

    it('keeps the title for a keyed avatar-name column', () => {
      expect(cellValue(record, { type: 'avatar-name', key: 'name', header: '이름' })).toBe('김승진');
    });
  });

  describe('columnSortField', () => {
    it('falls back to the named field of the type', () => {
      expect(columnSortField({ type: 'avatar-name', header: '이름' })).toBe('title');
      expect(columnSortField({ type: 'badge', header: '상태' })).toBe('badge.label');
      expect(columnSortField({ type: 'progress', header: '훈련' })).toBe('progress.value');
    });

    it('sorts a keyed column by its cell', () => {
      expect(columnSortField({ type: 'text', key: 'attended', header: '참석' })).toBe('cells.attended');
      expect(columnSortField({ type: 'badge', key: 'role', header: '역할' })).toBe('cells.role.label');
      expect(columnSortField({ type: 'progress', key: 'ratio', header: '비율' })).toBe('cells.ratio.value');
    });

    it('prefers an explicit sortKey', () => {
      expect(columnSortField({ type: 'avatar-name', header: '이름', sortKey: 'lastName' })).toBe('lastName');
      expect(columnSortField({ type: 'custom', key: 'training', header: '양육', sortKey: 'x' })).toBe('x');
    });

    it('never sorts actions, opted-out columns or custom cells without a sortKey', () => {
      expect(columnSortField({ type: 'actions', header: '관리' })).toBeNull();
      expect(columnSortField({ type: 'text', header: '순', sortable: false })).toBeNull();
      expect(columnSortField({ type: 'text', header: '순', sortable: false, sortKey: 'x' })).toBeNull();
      expect(columnSortField({ type: 'custom', key: 'training', header: '양육' })).toBeNull();
    });
  });

  describe('cell values', () => {
    it('tells badges and progress apart', () => {
      expect(asBadge(record.cells!['role'])).toEqual({ variant: 'group-leader', label: '순장' });
      expect(asBadge(record.cells!['ratio'])).toBeNull();
      expect(asBadge('활동')).toBeNull();
      expect(asProgress(record.cells!['ratio'])).toEqual({ value: 80, label: '80%' });
      expect(asProgress(record.cells!['role'])).toBeNull();
      expect(asProgress(null)).toBeNull();
    });

    it('renders any value as text', () => {
      expect(cellText('1순')).toBe('1순');
      expect(cellText(0)).toBe('0');
      expect(cellText(null)).toBe('');
      expect(cellText(undefined)).toBe('');
      expect(cellText({ variant: 'active', label: '활동' })).toBe('활동');
      expect(cellText({ value: 80, label: '80%' })).toBe('80%');
    });
  });

  describe('columnTone', () => {
    it('defaults by type and lets an explicit tone win', () => {
      expect(columnTone({ type: 'avatar-name', header: '이름' })).toBe('strong');
      expect(columnTone({ type: 'date', header: '등록일' })).toBe('muted');
      expect(columnTone({ type: 'text', header: '순' })).toBe('default');
      expect(columnTone({ type: 'text', header: '전체', tone: 'muted' })).toBe('muted');
    });
  });

  describe('columnId', () => {
    it('is the key, or type and header without one', () => {
      const keyed: DataColumn = { type: 'text', key: 'attended', header: '참석' };
      expect(columnId(keyed)).toBe('attended');
      expect(columnId({ type: 'text', header: '순' })).toBe('text:순');
    });
  });
});
