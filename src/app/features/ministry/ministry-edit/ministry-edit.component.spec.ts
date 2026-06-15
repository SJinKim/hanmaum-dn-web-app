import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { MinistryEditComponent } from './ministry-edit.component';
import { MinistryService } from '../ministry.service';
import { Ministry } from '../ministry.model';

describe('MinistryEditComponent', () => {
  let fixture: ComponentFixture<MinistryEditComponent>;
  let component: MinistryEditComponent;
  let ministryService: jasmine.SpyObj<MinistryService>;

  beforeEach(() => {
    ministryService = jasmine.createSpyObj<MinistryService>(
      'MinistryService',
      ['getMinistry', 'createMinistry', 'updateMinistry', 'uploadImage']
    );

    TestBed.configureTestingModule({
      imports: [MinistryEditComponent],
      providers: [
        { provide: MinistryService, useValue: ministryService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });

    fixture = TestBed.createComponent(MinistryEditComponent);
    component = fixture.componentInstance;
  });

  it('builds the new create payload with normalized structured fields', () => {
    component.form = {
      title: ' 난민 사역 ',
      subtitle: ' 사랑을 나눕니다 ',
      about: ' 월 1회 섬김 ',
      requirements: [' 양육 수료 ', ''],
      schedules: [
        { description: ' 준비 모임 ', startTime: '07:00', endTime: '09:00' },
      ],
      contacts: [{ role: ' 팀장 ', name: ' 김영원 권사님 ' }],
      imageUrl: ' https://example.com/ministry.jpg ',
      isActive: true,
    };

    const request = component['buildCreateRequest']();

    expect(request).toEqual({
      title: '난민 사역',
      subtitle: '사랑을 나눕니다',
      about: '월 1회 섬김',
      requirements: ['양육 수료'],
      schedules: [{ description: '준비 모임', startTime: '07:00', endTime: '09:00' }],
      contacts: [{ role: '팀장', name: '김영원 권사님' }],
      imageUrl: 'https://example.com/ministry.jpg',
    });
  });

  it('loads all structured response fields into the edit form', () => {
    const ministry: Ministry = {
      publicId: 'ministry-1',
      title: '난민 사역',
      subtitle: '사랑을 나눕니다',
      about: '월 1회 섬깁니다.',
      requirements: ['양육 수료'],
      schedules: [{ description: '준비 모임', startTime: '07:00', endTime: '09:00' }],
      contacts: [{ role: '팀장', name: '김영원 권사님' }],
      imageUrl: null,
      isActive: false,
    };

    component['fillForm'](ministry);

    expect(component.form).toEqual({
      title: ministry.title,
      subtitle: ministry.subtitle,
      about: ministry.about,
      requirements: ministry.requirements,
      schedules: ministry.schedules,
      contacts: ministry.contacts,
      imageUrl: '',
      isActive: false,
    });
    expect(component.form.requirements).not.toBe(ministry.requirements);
    expect(component.form.schedules[0]).not.toBe(ministry.schedules[0]);
    expect(component.form.contacts[0]).not.toBe(ministry.contacts[0]);
  });

  it('sends empty structured lists and an empty image string when clearing an existing ministry', () => {
    component.form = {
      title: '찬양팀',
      subtitle: '예배 찬양',
      about: '찬양으로 예배를 섬깁니다.',
      requirements: [],
      schedules: [],
      contacts: [],
      imageUrl: ' ',
      isActive: false,
    };

    expect(component['buildUpdateRequest']()).toEqual({
      title: '찬양팀',
      subtitle: '예배 찬양',
      about: '찬양으로 예배를 섬깁니다.',
      requirements: [],
      schedules: [],
      contacts: [],
      imageUrl: '',
      isActive: false,
    });
  });

  it('rejects schedules whose end time is not later than the start time', () => {
    component.form.title = '찬양팀';
    component.form.subtitle = '예배 찬양';
    component.form.about = '찬양으로 섬깁니다.';
    component.form.schedules = [
      { description: '연습', startTime: '09:00', endTime: '09:00' },
    ];

    expect(component['buildCreateRequest']()).toBeNull();
  });

  it('uploads a selected image before creating the ministry and stores the returned URL', () => {
    const file = new File(['image'], 'ministry.webp', { type: 'image/webp' });
    const created: Ministry = {
      publicId: 'ministry-1',
      title: '찬양팀',
      subtitle: '예배 찬양',
      about: '찬양으로 섬깁니다.',
      requirements: [],
      schedules: [],
      contacts: [],
      imageUrl: 'https://api.example.com/api/v1/media/pcloud/public-code',
      isActive: true,
    };
    spyOn(URL, 'createObjectURL').and.returnValue('blob:preview');
    ministryService.uploadImage.and.returnValue(of({ imageUrl: created.imageUrl! }));
    ministryService.createMinistry.and.returnValue(of(created));
    component.form.title = created.title;
    component.form.subtitle = created.subtitle;
    component.form.about = created.about;

    component.onImageSelected({
      target: { files: [file], value: 'ministry.webp' },
    } as unknown as Event);
    component.save();

    expect(ministryService.uploadImage).toHaveBeenCalledOnceWith(file);
    expect(ministryService.createMinistry).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      imageUrl: created.imageUrl,
    }));
  });
});
