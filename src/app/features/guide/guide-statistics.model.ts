export type GuideStatisticKey = 'SERVICE_1' | 'SERVICE_2' | 'SERVICE_3' | 'TOTAL';
export type GuideStatisticReason = 'NO_COMPLETE_REPORTS' | 'ZERO_TOTAL' | 'NO_CURRENT_DATA' | 'NO_BASELINE_DATA' | 'ZERO_BASELINE';
export interface GuideStatisticMetric {
  key: GuideStatisticKey; sum: number | null; average: number | null; averageReason: GuideStatisticReason | null;
  sharePercent: number | null; shareReason: GuideStatisticReason | null;
}
export interface GuideStatisticPeriod {
  from: string; to: string; firstReportDate: string | null; lastReportDate: string | null;
  firstCompleteDate: string | null; lastCompleteDate: string | null;
  reportCount: number; completeCount: number; incompleteCount: number; metrics: GuideStatisticMetric[];
}
export interface GuideStatisticChange {
  key: GuideStatisticKey; absoluteChange: number | null; absoluteReason: GuideStatisticReason | null;
  percentChange: number | null; percentReason: GuideStatisticReason | null;
}
export interface GuideStatisticPoint {
  serviceDate: string; service1Count: number | null; service2Count: number | null; service3Count: number | null;
  totalCount: number | null; complete: boolean;
}
export interface GuideStatistics {
  year: number; asOf: string; comparisonYear: number; timeZone: string;
  current: GuideStatisticPeriod; previousSamePeriod: GuideStatisticPeriod; previousFullYear: GuideStatisticPeriod;
  changesFromSamePeriod: GuideStatisticChange[]; changesFromFullYear: GuideStatisticChange[];
  timeline: GuideStatisticPoint[];
}
export const GUIDE_STATISTIC_KEYS: GuideStatisticKey[] = ['SERVICE_1', 'SERVICE_2', 'SERVICE_3', 'TOTAL'];

/** Presentation-only markers prevent Chart.js joining across missing weeks. Never aggregate these. */
export function guideTimelineWithGaps(points: GuideStatisticPoint[]): GuideStatisticPoint[] {
  const result: GuideStatisticPoint[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (previous) {
      const next = new Date(previous.serviceDate + 'T00:00:00Z');
      next.setUTCDate(next.getUTCDate() + 7);
      while (next.toISOString().slice(0, 10) < point.serviceDate) {
        result.push({ serviceDate: next.toISOString().slice(0, 10), service1Count: null, service2Count: null,
          service3Count: null, totalCount: null, complete: false });
        next.setUTCDate(next.getUTCDate() + 7);
      }
    }
    result.push(point);
  }
  return result;
}
