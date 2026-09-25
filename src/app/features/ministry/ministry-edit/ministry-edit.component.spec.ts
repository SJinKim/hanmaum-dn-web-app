import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { MinistryEditComponent } from './ministry-edit.component';
import { MinistryService } from '../ministry.service';
import { ActiveMinistryMemberDto, Ministry } from '../ministry.model';

const KO = {
  ministry: {
    title: '사역',
    memberCount: '팀원 {{count}}명',
    form: {
      card: '사역 정보',
      editTitle: '사역 정보 수정',
      newTitle: '새 사역 추가',
      newSubtitle: '새로운 사역 팀을 등록합니다.',
      breadcrumbEdit: '수정',
      breadcrumbNew: '새 사역 등록',
      save: '저장',
      create: '등록',
      hints: { leader: '리더 지정은 준비 중입니다' },
    },
  },
};

const MINISTRY: Ministry = {
  publicId: 'min-1',
  title: '찬양팀',
  subtitle: '주일 예배 찬양',
  about: '찬양으로 예배를 섬깁니다.',
  requirements: ['양육 수료'],
  schedules: [{ description: '연습', startTime: '09:00', endTime: '10:00' }],
  contacts: [{ role: '팀장', name: '김영원' }],
  imageUrl: null,
  isActive: true,
};

describe('MinistryEditComponent', () => {
  let service: jasmine.SpyObj<MinistryService>;
  let router: Router;

  function setup(publicId: string | null) {
    service = jasmine.createSpyObj<MinistryService>('MinistryService', [
      'getMinistry', 'getActiveMembers', 'createMinistry', 'updateMinistry',
    ]);
    service.getMinistry.and.returnValue(of(MINISTRY));
    service.getActiveMembers.and.returnValue(of([{}, {}, {}] as ActiveMinistryMemberDto[]));

    TestBed.configureTestingModule({
      imports: [MinistryEditComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: MinistryService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(publicId ? { publicId } : {}) } },
        },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    const fixture = TestBed.createComponent(MinistryEditComponent);
    fixture.detectChanges();
    return fixture;
  }

  describe('new', () => {
    it('shows the create header and the 등록 button', () => {
      const fixture = setup(null);
      const c = fixture.componentInstance;
      expect(c.breadcrumb()).toEqual(['사역', '새 사역 등록']);
      expect(c.heading()).toBe('새 사역 추가');
      expect(c.subtitle()).toBe('새로운 사역 팀을 등록합니다.');
      expect(fixture.nativeElement.textContent).toContain('등록');
      expect(service.getMinistry).not.toHaveBeenCalled();
    });

    it('requires 사역명 and 설명 before posting', () => {
      const fixture = setup(null);
      fixture.componentInstance.save();
      expect(service.createMinistry).not.toHaveBeenCalled();
      expect(fixture.componentInstance.hasError('title', 'required')).toBeTrue();
      expect(fixture.componentInstance.hasError('subtitle', 'required')).toBeTrue();
    });

    it('posts 설명 as both subtitle and about, then opens the detail', () => {
      const fixture = setup(null);
      service.createMinistry.and.returnValue(of({ ...MINISTRY, publicId: 'new-1' }));
      const c = fixture.componentInstance;
      c.form.patchValue({ title: ' 난민 사역 ', subtitle: ' 사랑을 나눕니다 ' });

      c.save();

      expect(service.createMinistry).toHaveBeenCalledWith({
        title: '난민 사역',
        subtitle: '사랑을 나눕니다',
        about: '사랑을 나눕니다',
        requirements: [],
        schedules: [],
        contacts: [],
        imageUrl: null,
      });
      expect(service.updateMinistry).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/ministry', 'new-1']);
    });

    it('patches a ministry created as 비활성 to inactive', () => {
      const fixture = setup(null);
      const created = { ...MINISTRY, publicId: 'new-1', title: '난민 사역', subtitle: '섬김', about: '섬김' };
      service.createMinistry.and.returnValue(of(created));
      service.updateMinistry.and.returnValue(of({ ...created, isActive: false }));
      const c = fixture.componentInstance;
      c.form.patchValue({ title: '난민 사역', subtitle: '섬김', isActive: false });

      c.save();

      expect(service.updateMinistry).toHaveBeenCalledWith('new-1', jasmine.objectContaining({
        title: '난민 사역', about: '섬김', imageUrl: '', isActive: false,
      }));
      expect(router.navigate).toHaveBeenCalledWith(['/ministry', 'new-1']);
    });
  });

  describe('edit', () => {
    it('fills the form and shows "{title} · 팀원 N명"', () => {
      const fixture = setup('min-1');
      const c = fixture.componentInstance;
      expect(c.form.getRawValue()).toEqual(jasmine.objectContaining({
        title: '찬양팀', subtitle: '주일 예배 찬양', isActive: true,
      }));
      expect(c.breadcrumb()).toEqual(['사역', '찬양팀', '수정']);
      expect(c.heading()).toBe('사역 정보 수정');
      expect(c.subtitle()).toBe('찬양팀 · 팀원 3명');
    });

    it('keeps about, lists and image when saving', () => {
      const fixture = setup('min-1');
      service.updateMinistry.and.returnValue(of(MINISTRY));
      const c = fixture.componentInstance;
      c.form.patchValue({ title: '찬양팀 A', subtitle: '', isActive: false });

      c.save();

      expect(service.updateMinistry).toHaveBeenCalledWith('min-1', {
        title: '찬양팀 A',
        subtitle: '',
        about: MINISTRY.about,
        requirements: MINISTRY.requirements,
        schedules: MINISTRY.schedules,
        contacts: MINISTRY.contacts,
        imageUrl: '',
        isActive: false,
      });
      expect(router.navigate).toHaveBeenCalledWith(['/ministry', 'min-1']);
    });

    it('keeps the form open when saving fails', () => {
      const fixture = setup('min-1');
      service.updateMinistry.and.returnValue(throwError(() => new Error('500')));
      const c = fixture.componentInstance;

      c.save();

      expect(c.saving()).toBeFalse();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('keeps 리더 disabled with a hint', () => {
      const fixture = setup('min-1');
      expect(fixture.componentInstance.form.controls.leader.disabled).toBeTrue();
      const hint = fixture.nativeElement.querySelector('[data-testid="leader-hint"]') as HTMLElement;
      expect(hint.textContent).toContain('리더 지정은 준비 중입니다');
    });
  });
});
