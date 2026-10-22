import { GuideHomeSnapshot } from '../../core/models/guide-home.model';

export function guideHomeFixture(): GuideHomeSnapshot {
  const report = { publicId: 'report-18', serviceDate: '2026-10-18', version: 2, reportMode: 'SUMMARY_ONLY' as const,
    complete: true, service1Count: 186, service2Count: 384, service3Count: 146, totalCount: 716,
    previousWeekDelta: 63, notes: 'note\nline' };
  return { asOf: '2026-10-25T08:00:00Z', timeZone: 'Europe/Berlin', currentSunday: '2026-10-25', snapshotVersion: 'v1',
    status: 'COMPLETE', waitingForCurrentSunday: true, attendance: { report, entries: [], rooms: [], services: [], totals: null },
    currentSundayReport: null, lastFourReports: [report],
    metrics: { reportDate: '2026-10-18', totalCount: 716, referenceDate: '2026-10-11', referenceTotal: 653, absoluteChange: 63,
      percentChange: 9.647779479326, percentReason: null, meanLastFour: 705.5, meanReportCount: 4,
      meanFrom: '2026-09-27', meanTo: '2026-10-18' },
    timeline: [{ serviceDate: '2026-10-18', service1Count: 186, service2Count: 384, service3Count: 146, totalCount: 716 },
      { serviceDate: '2026-10-25', service1Count: null, service2Count: null, service3Count: null, totalCount: null }],
    sharesReportDate: '2026-10-18', shares: [
      { serviceNumber: 1, count: 186, percent: 25.977653 }, { serviceNumber: 2, count: 384, percent: 53.631284 },
      { serviceNumber: 3, count: 146, percent: 20.391061 }], sharesReason: null };
}
