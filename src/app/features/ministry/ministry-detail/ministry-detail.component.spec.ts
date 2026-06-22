import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { MinistryDetailComponent } from './ministry-detail.component';
import { MinistryService } from '../ministry.service';
import { Ministry } from '../ministry.model';

describe('MinistryDetailComponent', () => {
  let fixture: ComponentFixture<MinistryDetailComponent>;

  const ministry: Ministry = {
    publicId: 'ministry-1',
    title: '난민 사역',
    subtitle: '하나님의 사랑을 나눕니다.',
    about: '한 달에 한 번 난민 아이들을 섬깁니다.',
    requirements: ['큐베세 양육 수료자'],
    schedules: [
      { description: '준비 모임', startTime: '07:00', endTime: '09:00' },
    ],
    contacts: [{ role: '팀장', name: '김영원 권사님' }],
    imageUrl: null,
    isActive: true,
  };

  beforeEach(() => {
    const ministryService = jasmine.createSpyObj<MinistryService>(
      'MinistryService',
      ['getMinistry', 'getActiveMembers', 'getMemberNames', 'addMember'],
    );
    ministryService.getMinistry.and.returnValue(of(ministry));
    ministryService.getActiveMembers.and.returnValue(of([]));
    ministryService.getMemberNames.and.returnValue(of([]));

    TestBed.configureTestingModule({
      imports: [MinistryDetailComponent],
      providers: [
        { provide: MinistryService, useValue: ministryService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ publicId: ministry.publicId }) },
          },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });

    fixture = TestBed.createComponent(MinistryDetailComponent);
    fixture.detectChanges();
  });

  it('renders the structured ministry details returned by the server', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain(ministry.title);
    expect(text).toContain(ministry.subtitle);
    expect(text).toContain(ministry.about);
    expect(text).toContain(ministry.requirements[0]);
    expect(text).toContain(ministry.schedules[0].description);
    expect(text).toContain('07:00 – 09:00');
    expect(text).toContain(ministry.contacts[0].role);
    expect(text).toContain(ministry.contacts[0].name);
  });

  it('uses 맴버 wording for the active-members section', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('현재 활동 맴버');
    expect(text).toContain('맴버 추가');
    expect(text).not.toContain('현재 활동 회원');
  });

  it('onMemberAdded() appends the returned row to the active members table', () => {
    const component = fixture.componentInstance;
    component.onMemberAdded({
      publicId: 'm9', fullName: '박지성', startDate: '2026-06-01', note: null, gender: 'M',
    });
    fixture.detectChanges();
    expect(component.activeMembers().length).toBe(1);
    expect((fixture.nativeElement.textContent as string)).toContain('박지성');
  });
});
