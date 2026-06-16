export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface DefinitionDto {
  publicId: string;
  title: string;
  dayOfWeek: DayOfWeek;
  windowStart: string; // "HH:mm:ss"
  windowEnd: string;
  isActive: boolean;
}

export interface AttendanceCheckInResponse {
  definitionPublicId: string;
  definitionTitle: string;
  attendanceDate: string; // ISO date "YYYY-MM-DD"
}

export interface ChurchGroupAttendanceCountResponse {
  groupPublicId: string | null;
  groupDivision: string | null;
  groupName: string | null;
  attendanceCount: number;
}

export interface AttendanceGroupCountsResponse {
  definitionPublicId: string;
  definitionTitle: string;
  attendanceDate: string; // ISO date "YYYY-MM-DD"
  totalCount: number;
  groups: ChurchGroupAttendanceCountResponse[];
}

export interface CreateDefinitionRequest {
  title: string;
  dayOfWeek: DayOfWeek;
  windowStart: string; // "HH:mm:ss"
  windowEnd: string;
}

export interface UpdateDefinitionRequest {
  title?: string;
  dayOfWeek?: DayOfWeek;
  windowStart?: string;
  windowEnd?: string;
  isActive?: boolean;
}

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  MONDAY:    '월요일',
  TUESDAY:   '화요일',
  WEDNESDAY: '수요일',
  THURSDAY:  '목요일',
  FRIDAY:    '금요일',
  SATURDAY:  '토요일',
  SUNDAY:    '일요일',
};

export const DAY_OF_WEEK_OPTIONS = (Object.entries(DAY_OF_WEEK_LABELS) as [DayOfWeek, string][])
  .map(([value, label]) => ({ value, label }));

/**
 * Column / fallback labels for the attendance distribution table.
 * Centralized so an i18n pass can swap these for translation keys in one place
 * instead of hunting through templates.
 */
export const ATTENDANCE_COLUMN_LABELS = {
  division:        '교구',
  name:            '순',
  attendanceCount: '출석 수',
  share:           '비중',
  distribution:    '분포',
  noGroup:         '소속 그룹 없음',
} as const;

/**
 * Display labels for division codes. The backend already sends Korean
 * (느헤미야 / 다니엘), but legacy/code forms are mapped here too. Centralized
 * for the future i18n pass.
 */
export const DIVISION_LABELS: Record<string, string> = {
  NEHEMIA:  '느헤미야',
  NEHEMIAH: '느헤미야',
  DANIEL:   '다니엘',
};
