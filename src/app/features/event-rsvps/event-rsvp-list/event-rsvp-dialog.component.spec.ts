import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { EventRsvpDto } from '../event-rsvp.model';
import { EventRsvpService } from '../event-rsvp.service';
import { EventRsvpDialogComponent, endOfDay, startOfDay } from './event-rsvp-dialog.component';

const RSVP: EventRsvpDto = {
  publicId: 'e1', title: '가을 수련회', description: '설명', windowStart: '2026-09-01T00:00:00Z',
  windowEnd: '2026-09-20T14:59:59Z', isActive: true, announcementPublicId: 'a1',
};

describe('EventRsvpDialogComponent', () => {
  let service: jasmine.SpyObj<EventRsvpService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<EventRsvpService>('EventRsvpService', ['createRsvp', 'updateRsvp', 'getEventAnnouncements']);
    service.getEventAnnouncements.and.returnValue(of([{ id: 'a1', title: '수련회 안내' }, { id: 'a2', title: '다른 행사' }]));
    TestBed.configureTestingModule({
      imports: [EventRsvpDialogComponent],
      providers: [
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: EventRsvpService, useValue: service },
      ],
    });
  });

  function render(rsvp: EventRsvpDto | null) {
    const fixture = TestBed.createComponent(EventRsvpDialogComponent);
    fixture.componentRef.setInput('rsvp', rsvp);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('snaps the window to whole days', () => {
    const d = new Date(2026, 8, 18, 13, 45);
    expect(startOfDay(d).getHours()).toBe(0);
    expect(endOfDay(d).getHours()).toBe(23);
    expect(endOfDay(d).getMinutes()).toBe(59);
  });

  it('does not submit without a title or window', () => {
    const c = render(null);
    c.submit();
    expect(service.createRsvp).not.toHaveBeenCalled();
    expect(c.hasError('title')).toBeTrue();
  });

  it('rejects an end before the start', () => {
    const c = render(null);
    c.form.patchValue({ title: 'x', windowStart: new Date(2026, 8, 10), windowEnd: new Date(2026, 8, 9) });
    expect(c.endBeforeStart()).toBeTrue();
    c.submit();
    expect(service.createRsvp).not.toHaveBeenCalled();
  });

  it('creates with 바로 공개 and emits the saved event', () => {
    service.createRsvp.and.returnValue(of({ ...RSVP, isActive: false }));
    const c = render(null);
    const saved = jasmine.createSpy('saved');
    c.saved.subscribe(saved);
    c.form.patchValue({ title: ' 새 이벤트 ', isActive: false, windowStart: new Date(2026, 8, 1), windowEnd: new Date(2026, 8, 2) });
    c.submit();
    const req = service.createRsvp.calls.mostRecent().args[0];
    expect(req.isActive).toBeFalse();
    expect(req.description).toBeNull();
    expect(saved).toHaveBeenCalled();
    expect(c.visible()).toBeFalse();
  });

  it('patches the event when the server ignores isActive on create', () => {
    service.createRsvp.and.returnValue(of(RSVP));
    service.updateRsvp.and.returnValue(of({ ...RSVP, isActive: false }));
    const c = render(null);
    c.form.patchValue({ title: 'x', isActive: false, windowStart: new Date(2026, 8, 1), windowEnd: new Date(2026, 8, 2) });
    c.submit();
    expect(service.updateRsvp).toHaveBeenCalledWith('e1', { isActive: false });
  });

  it('edits without touching the linked announcement', () => {
    service.updateRsvp.and.returnValue(of(RSVP));
    const c = render(RSVP);
    expect(c.form.controls.title.value).toBe('가을 수련회');
    c.submit();
    const [id, req] = service.updateRsvp.calls.mostRecent().args;
    expect(id).toBe('e1');
    expect('announcementId' in req).toBeFalse();
  });

  it('links the selected EVENT announcement when creating', () => {
    service.createRsvp.and.returnValue(of(RSVP));
    const c = render(null);
    c.form.patchValue({ title: '행사', announcementId: 'a1', windowStart: new Date(2026, 8, 1), windowEnd: new Date(2026, 8, 2) });
    c.submit();
    expect(service.createRsvp.calls.mostRecent().args[0].announcementId).toBe('a1');
  });

  it('loads the current announcement and saves a replacement on edit', () => {
    service.updateRsvp.and.returnValue(of(RSVP));
    const c = render(RSVP);
    expect(c.form.controls.announcementId.value).toBe('a1');
    expect(c.announcementOptions().length).toBe(2);
    c.form.patchValue({ announcementId: 'a2' });
    c.submit();
    expect(service.updateRsvp.calls.mostRecent().args[1].announcementId).toBe('a2');
  });

  it('preserves the linked announcement when loading choices fails and supports retry', () => {
    service.getEventAnnouncements.and.returnValue(throwError(() => new Error('offline')));
    service.updateRsvp.and.returnValue(of(RSVP));
    const c = render(RSVP);
    expect(c.announcementsFailed()).toBeTrue();
    expect(c.announcementOptions()[0].id).toBe('a1');
    service.getEventAnnouncements.and.returnValue(of([{ id: 'a1', title: '수련회 안내' }]));
    c.loadAnnouncements();
    expect(c.announcementsFailed()).toBeFalse();
    c.submit();
    expect(service.updateRsvp.calls.mostRecent().args[1].announcementId).toBeUndefined();
  });

  it('keeps the announcement chosen through the PrimeNG dropdown after change detection', async () => {
    const fixture = TestBed.createComponent(EventRsvpDialogComponent);
    fixture.componentRef.setInput('rsvp', RSVP);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const c = fixture.componentInstance;
    fixture.nativeElement.querySelector('[data-testid="event-announcement"] [role="combobox"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
      .find(element => element.textContent?.includes('다른 행사'));
    expect(option).toBeDefined();
    option!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(c.form.controls.announcementId.value).toBe('a2');
  });
});
