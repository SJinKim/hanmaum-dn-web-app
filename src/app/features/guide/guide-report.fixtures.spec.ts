import { GuideReport } from './guide-report.model';
import { PageResponse } from '../../core/models/api-response.model';

export const reportFixture: GuideReport = {
  publicId: 'a', serviceDate: '2026-10-18', service1Count: 186, service2Count: 384, service3Count: 146,
  totalCount: 716, previousWeekDelta: 63, notes: 'note\nsecond line', version: 3, reportMode: 'SUMMARY_ONLY', complete: true,
};
export const previousFixture: GuideReport = { ...reportFixture, publicId: 'b', serviceDate: '2026-10-11',
  service1Count: 171, service2Count: 338, service3Count: 144, totalCount: 653, previousWeekDelta: -27 };
export function reportPage(content: GuideReport[], totalElements = content.length, number = 0, size = 6): PageResponse<GuideReport> {
  return { content, number, size, totalElements, totalPages: Math.ceil(totalElements / size) };
}
