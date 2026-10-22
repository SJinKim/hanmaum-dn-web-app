import { GuideDetails, GuideSnapshotArea } from './guide-details.model';
import { reportFixture } from './guide-report.fixtures.spec';
export const areaFixture: GuideSnapshotArea = { areaPublicId: 'a', roomPublicId: 'room', roomName: 'Original room', label: 'Original A', displayOrder: 0 };
export function detailFixture(): GuideDetails {
  const counts = { adultCount: 40, youthCount: 25, schoolCount: 5, compatibleAdultCount: 65, totalCount: 70, complete: true };
  return { report: { ...reportFixture, reportMode: 'DETAILED' }, rooms: [{ ...areaFixture, counts }],
    entries: ([1, 2, 3] as const).map(serviceNumber => ({ areaPublicId: 'a', serviceNumber, counts: { ...counts, youthCount: serviceNumber === 3 ? 25 : null } })),
    services: [], totals: counts };
}
