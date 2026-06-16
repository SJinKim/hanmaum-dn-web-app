import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AttendanceService } from './attendance.service';
import { AttendanceGroupCountsResponse } from './attendance.model';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let api: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch', 'delete']);
    TestBed.configureTestingModule({
      providers: [
        AttendanceService,
        { provide: ApiService, useValue: api },
      ],
    });
    service = TestBed.inject(AttendanceService);
  });

  it('requests attendance counts grouped by church group', done => {
    const response: AttendanceGroupCountsResponse = {
      definitionPublicId: 'def-1',
      definitionTitle: '주일 예배',
      attendanceDate: '2026-06-16',
      totalCount: 3,
      groups: [
        {
          groupPublicId: 'group-1',
          groupDivision: 'NEHEMIA',
          groupName: '믿음',
          attendanceCount: 3,
        },
      ],
    };
    api.get.and.returnValue(of(response));

    service.getGroupCounts({ definitionId: 'def-1', date: '2026-06-16' }).subscribe(result => {
      expect(result).toBe(response);
      expect(api.get).toHaveBeenCalledOnceWith('/v1/attendance/group-counts', {
        definitionId: 'def-1',
        date: '2026-06-16',
      });
      done();
    });
  });
});
