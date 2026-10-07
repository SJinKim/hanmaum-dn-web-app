/** `ChartDataDto` — one labelled count, e.g. `{ label: '자매', value: 52 }`. */
export interface ChartDatum {
  label: string;
  value: number;
}

/** The time window of the trend, rate and division charts. */
export type StatisticsPeriod = '30d' | 'quarter' | 'year';

/**
 * `TrendSeriesDto` — one line of 성장 추이. Point labels are buckets:
 * `2026-01` for a month, `2026-10-07` for a day.
 */
export interface TrendSeries {
  year: number;
  points: ChartDatum[];
}

/** `ServiceAttendanceDto` — check-ins of one service, this week against last. */
export interface ServiceAttendance {
  definitionPublicId: string;
  title: string;
  /** `HH:mm:ss` */
  windowStart: string;
  thisWeek: number;
  lastWeek: number;
}

/** `TrainingStageDto` — members currently in one 양육 course. */
export interface TrainingStage {
  code: string;
  name: string;
  count: number;
}

/** `GET /v1/statistics/dashboard` — `DashboardStatsDto`. */
export interface DashboardStats {
  totalMembers: number;
  newMembersYtd: number;
  averageAge: number;
  cityDistribution: ChartDatum[];
  ageDistribution: ChartDatum[];
  genderDistribution: ChartDatum[];
  period: StatisticsPeriod;
  /** Current year first, then the same buckets one year earlier. */
  growthTrend: TrendSeries[];
  /** Percent per bucket. */
  attendanceRate: ChartDatum[];
  serviceAttendance: ServiceAttendance[];
  divisionAttendance: ChartDatum[];
  trainingStages: TrainingStage[];
  /** Largest first. */
  ministryHeadcount: ChartDatum[];
}
