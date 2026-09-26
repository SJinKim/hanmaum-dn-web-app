import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { AnnouncementDto } from '../announcements.model';
import { AnnouncementsService } from '../announcements.service';
import { AnnouncementsListComponent } from './announcements-list.component';

const KO = {
  announcements: {
    all: '전체',
    category: { NOTICE: '공지', MINISTRY: '사역', EVENT: '행사' },
    period: '게시 기간 {{start}} - {{end}}',
    openEnd: '종료일 없음',
    edit: '수정',
    delete: { action: '삭제' },
  },
};

const ITEMS: AnnouncementDto[] = [
  { id: 'a1', title: '수련회 안내', body: '여름 수련회 신청', category: 'EVENT',
    startAt: '2026-09-01T12:00:00Z', endAt: '2026-09-30T12:00:00Z', isPinned: false },
  { id: 'a2', title: '예배 시간 변경', body: '주일 예배가 10시로', category: 'NOTICE',
    startAt: '2026-08-01T12:00:00Z', endAt: null, isPinned: true },
  { id: 'a3', title: '찬양팀 모집', body: '수련회 찬양 인원', category: 'MINISTRY',
    startAt: '2026-09-10T12:00:00Z', endAt: null, isPinned: false },
];

describe('AnnouncementsListComponent', () => {
  let service: jasmine.SpyObj<AnnouncementsService>;
  let focus: string | null;

  beforeEach(() => {
    service = jasmine.createSpyObj<AnnouncementsService>('AnnouncementsService', [
      'getAnnouncements', 'createAnnouncement', 'updateAnnouncement', 'deleteAnnouncement',
    ]);
    service.getAnnouncements.and.returnValue(of(ITEMS));
    focus = null;

    TestBed.configureTestingModule({
      imports: [AnnouncementsListComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: AnnouncementsService, useValue: service },
        { provide: ActivatedRoute, useFactory: () => ({ snapshot: { queryParamMap: convertToParamMap(focus ? { focus } : {}) } }) },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');
  });

  function render() {
    const fixture = TestBed.createComponent(AnnouncementsListComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('lists 고정 first, then the newest 시작일', () => {
    expect(render().componentInstance.rows().map(r => r.id)).toEqual(['a2', 'a3', 'a1']);
  });

  it('maps category to the Figma badge and formats the 게시 기간', () => {
    const rows = render().componentInstance.rows();
    expect(rows.find(r => r.id === 'a1')!.badge).toEqual({ variant: 'pending', label: '행사' });
    expect(rows.find(r => r.id === 'a1')!.period).toBe('게시 기간 2026.09.01 - 2026.09.30');
    expect(rows.find(r => r.id === 'a2')!.period).toBe('게시 기간 2026.08.01 - 종료일 없음');
  });

  it('counts the chips 전체 | 공지 | 사역 | 행사', () => {
    expect(render().componentInstance.chips().map(c => `${c.label} ${c.count}`))
      .toEqual(['전체 3', '공지 1', '사역 1', '행사 1']);
  });

  it('filters by chip and clears on the same chip again', () => {
    const c = render().componentInstance;
    c.selectCategory('MINISTRY');
    expect(c.rows().map(r => r.id)).toEqual(['a3']);
    c.selectCategory('MINISTRY');
    expect(c.rows().length).toBe(3);
  });

  it('searches title and body, and the chip counts follow the search', () => {
    const c = render().componentInstance;
    c.search.set('수련회');
    expect(c.rows().map(r => r.id)).toEqual(['a3', 'a1']);
    expect(c.chips()[0].count).toBe(2);
  });

  it('shows the pin icon only on 고정 rows', () => {
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelector('[data-announcement="a2"] [data-testid="pinned-icon"]')).not.toBeNull();
    expect(el.querySelector('[data-announcement="a1"] [data-testid="pinned-icon"]')).toBeNull();
  });

  it('opens the dialog empty for 추가 and filled for 수정', () => {
    const c = render().componentInstance;
    c.openAdd();
    expect(c.editing()).toBeNull();
    expect(c.dialogVisible()).toBeTrue();
    c.openEdit('a3');
    expect(c.editing()).toBe(ITEMS[2]);
  });

  it('opens ?focus=<id> for editing', () => {
    focus = 'a1';
    const c = render().componentInstance;
    expect(c.editing()).toBe(ITEMS[0]);
    expect(c.dialogVisible()).toBeTrue();
  });

  it('deletes after confirm and reloads', () => {
    const fixture = render();
    const confirm = fixture.debugElement.injector.get(ConfirmationService);
    spyOn(confirm, 'confirm').and.callFake(opts => { opts.accept?.(); return confirm; });
    service.deleteAnnouncement.and.returnValue(of(void 0));
    service.getAnnouncements.calls.reset();

    fixture.componentInstance.confirmDelete('a1');

    expect(service.deleteAnnouncement).toHaveBeenCalledWith('a1');
    expect(service.getAnnouncements).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when deleting fails', () => {
    const fixture = render();
    const confirm = fixture.debugElement.injector.get(ConfirmationService);
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(confirm, 'confirm').and.callFake(opts => { opts.accept?.(); return confirm; });
    spyOn(messages, 'add');
    service.deleteAnnouncement.and.returnValue(throwError(() => new Error('500')));

    fixture.componentInstance.confirmDelete('a1');

    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
  });

  it('shows the error state when loading fails', () => {
    service.getAnnouncements.and.returnValue(throwError(() => new Error('500')));
    const fixture = render();
    expect(fixture.componentInstance.failed()).toBeTrue();
    expect(fixture.nativeElement.querySelector('[data-testid="announcements-card"]')).toBeNull();
  });
});
