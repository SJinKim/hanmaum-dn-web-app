import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { MinistryListComponent } from './ministry-list.component';
import { MinistryService } from '../ministry.service';

describe('MinistryListComponent — wording', () => {
  beforeEach(() => {
    const ministryService = jasmine.createSpyObj<MinistryService>(
      'MinistryService',
      ['getMinistries', 'deactivateMinistry'],
    );
    ministryService.getMinistries.and.returnValue(of([]));

    TestBed.configureTestingModule({
      imports: [MinistryListComponent],
      providers: [
        { provide: MinistryService, useValue: ministryService },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });
  });

  it('renders the renamed header and add button', () => {
    const fixture = TestBed.createComponent(MinistryListComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('사역팀 관리');
    expect(text).toContain('사역 추가');
    expect(text).not.toContain('부서 관리');
  });
});
