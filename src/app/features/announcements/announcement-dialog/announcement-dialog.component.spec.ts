import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { AnnouncementDto } from '../announcements.model';
import { AnnouncementsService } from '../announcements.service';
import { AnnouncementDialogComponent } from './announcement-dialog.component';

const EXISTING: AnnouncementDto = {
  id: 'a1', title: '수련회 안내', body: '여름 수련회', category: 'EVENT',
  startAt: '2026-09-01T00:00:00+09:00', endAt: null,
  imageUrl: 'https://img/1.png', location: '본당', isPinned: true,
};

describe('AnnouncementDialogComponent', () => {
  let service: jasmine.SpyObj<AnnouncementsService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<AnnouncementsService>('AnnouncementsService', ['createAnnouncement', 'updateAnnouncement']);
    service.createAnnouncement.and.returnValue(of(EXISTING));
    service.updateAnnouncement.and.returnValue(of(EXISTING));
    TestBed.configureTestingModule({
      imports: [AnnouncementDialogComponent],
      providers: [
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: AnnouncementsService, useValue: service },
      ],
    });
  });

  function render(announcement: AnnouncementDto | null = null) {
    const fixture = TestBed.createComponent(AnnouncementDialogComponent);
    fixture.componentRef.setInput('announcement', announcement);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    return fixture;
  }

  it('does not submit an empty form', () => {
    const c = render().componentInstance;
    c.submit();
    expect(service.createAnnouncement).not.toHaveBeenCalled();
    expect(c.hasError('title')).toBeTrue();
    expect(c.hasError('startAt')).toBeTrue();
  });

  it('creates with whole days: 시작일 from 00:00, 종료일 until 23:59', () => {
    const c = render().componentInstance;
    c.form.setValue({
      title: ' 공지 ', body: '내용', category: 'MINISTRY', isPinned: true,
      startAt: new Date(2026, 8, 1, 15), endAt: new Date(2026, 8, 3, 9),
    });
    c.submit();
    const req = service.createAnnouncement.calls.mostRecent().args[0];
    expect(req.title).toBe('공지');
    expect(req.category).toBe('MINISTRY');
    expect(req.isPinned).toBeTrue();
    expect(new Date(req.startAt).getHours()).toBe(0);
    expect(new Date(req.endAt!).getHours()).toBe(23);
  });

  it('rejects a 종료일 before the 시작일', () => {
    const c = render().componentInstance;
    c.form.patchValue({ title: 't', body: 'b', startAt: new Date(2026, 8, 5), endAt: new Date(2026, 8, 4) });
    expect(c.endBeforeStart()).toBeTrue();
    c.submit();
    expect(service.createAnnouncement).not.toHaveBeenCalled();
  });

  it('fills the form for 수정 and keeps imageUrl and location on update', () => {
    const fixture = render(EXISTING);
    const c = fixture.componentInstance;
    expect(c.form.value.title).toBe('수련회 안내');
    expect(c.form.value.isPinned).toBeTrue();
    c.submit();
    expect(service.updateAnnouncement).toHaveBeenCalledWith('a1', jasmine.objectContaining({
      imageUrl: 'https://img/1.png', location: '본당', endAt: null,
    }));
  });

  it('emits saved and closes on success, failed on error', () => {
    const fixture = render(EXISTING);
    const c = fixture.componentInstance;
    const saved = jasmine.createSpy('saved');
    const failed = jasmine.createSpy('failed');
    c.saved.subscribe(saved);
    c.failed.subscribe(failed);

    c.submit();
    expect(saved).toHaveBeenCalledWith(EXISTING);
    expect(c.visible()).toBeFalse();

    service.updateAnnouncement.and.returnValue(throwError(() => new Error('500')));
    c.submit();
    expect(failed).toHaveBeenCalled();
    expect(c.saving()).toBeFalse();
  });
});
