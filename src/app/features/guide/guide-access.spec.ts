import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';
import { AuthService } from '../../core/services/auth.service';
import { RoleService } from '../../core/services/role.service';

describe('Guide route and role matrix', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  for (const [role, read, write] of [
    ['GUIDE_VIEWER', true, false], ['GUIDE_EDITOR', true, true], ['ADMIN', true, true],
    ['PASTOR', true, true], ['MEMBER', false, false], ['GENERAL_OPERATIONS_EDITOR', false, false],
  ] as const) {
    it(`enforces read/write access for ${role} on direct routes and actions`, () => {
      TestBed.inject(AuthService).roles.set([role]);
      const service = TestBed.inject(RoleService);
      expect(service.canRead('guide')).toBe(read); expect(service.canWrite('guide')).toBe(write);
      const guard = featureGuard('guide');
      expect(TestBed.runInInjectionContext(() => guard({} as never, {} as never)) === true).toBe(read);
    });
  }
});
