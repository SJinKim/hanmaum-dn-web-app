import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

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
    service = jasmine.createSpyObj<EventRsvpService>('EventRsvpService', ['createRsvp', 'updateRsvp']);
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
});
