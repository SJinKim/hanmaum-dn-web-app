import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import {
  longAbsenceChangeFixture,
  longAbsenceFixture,
  longAbsenceHistoryItemFixture,
  longAbsenceListFixture,
  longAbsencePhaseFixture,
  longAbsenceReturnFixture,
  longAbsenceSummaryFixture,
  pageFixture,
} from '../../../core/models/long-absent.fixtures.spec';
import { LongAbsence, LongAbsenceHistoryItem } from '../../../core/models/long-absent.model';
import { AuthService } from '../../../core/services/auth.service';
import { LongAbsentApi } from '../../../core/services/long-absent-api.service';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { LongAbsentPageComponent } from './long-absent-page.component';

const KO = {
  statistics: {
    tabs: { statistics: '통계', longAbsent: '장기결석자' },
    longAbsent: {
      badge: '{{months}}개월 · {{level}}개월+',
      total: '전체 {{count}}명',
      filter: { all: '전체 {{count}}', open: '미연락 {{count}}', done: '연락함 {{count}}' },
      memoDialog: { tooLong: '최대 {{max}}자' },
    },
  },
};

function httpError(status: number, code?: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: code ? { status, code } : { status } });
}

describe('LongAbsentPageComponent (#277)', () => {
  let api: jasmine.SpyObj<LongAbsentApi>;
  let desktop: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    api = jasmine.createSpyObj<LongAbsentApi>('LongAbsentApi', [
      'list', 'summary', 'setContactStatus', 'setMemo', 'markReturned', 'history', 'phase', 'changes',
    ]);
    api.list.and.returnValue(of(longAbsenceListFixture()));
    api.summary.and.returnValue(of(longAbsenceSummaryFixture()));
    api.history.and.returnValue(of(pageFixture<LongAbsenceHistoryItem>([])));
    desktop = signal(true);
    TestBed.configureTestingModule({
      imports: [LongAbsentPageComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: LongAbsentApi, useValue: api },
        { provide: BreakpointService, useValue: { isDesktop: desktop, isPhone: signal(false) } },
      ],
    });
    TestBed.inject(AuthService).roles.set(['pastor']);
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');
  });

  function render(): ComponentFixture<LongAbsentPageComponent> {
    const fixture = TestBed.createComponent(LongAbsentPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  const el = (f: ComponentFixture<LongAbsentPageComponent>) => f.nativeElement as HTMLElement;
  const all = (f: ComponentFixture<LongAbsentPageComponent>, id: string) =>
    Array.from(el(f).querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
  const one = (f: ComponentFixture<LongAbsentPageComponent>, id: string) =>
    el(f).querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const dialogText = () => document.body.querySelector('.p-dialog')?.textContent ?? '';

  afterEach(() =>
    document.body.querySelectorAll('.p-dialog-mask, .p-dialog, .p-drawer-mask, .p-drawer').forEach(n => n.remove()),
  );

  it('loads the list once and the summary for the tab, and starts on 미연락 with the total visible', () => {
    const f = render();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.summary).toHaveBeenCalledTimes(1);
    expect(all(f, 'long-absent-name').map(n => n.textContent?.trim())).toEqual(['John Doe', '홍길동']);
    expect(one(f, 'long-absent-total')?.textContent).toContain('전체 3명');
    expect(one(f, 'tab-count')?.textContent).toContain('2');
    expect(one(f, 'long-absent-filter')?.textContent).toContain('미연락 2');
  });

  it('marks exactly the 장기결석자 tab as current page', () => {
    // Router state is not driven here; the routing spec covers aria-current.
    const f = render();
    expect(one(f, 'tab-long-absent')?.getAttribute('href')).toBe('/analytics/long-absences');
    expect(one(f, 'tab-statistics')?.getAttribute('href')).toBe('/analytics');
  });

  it('shows urgency as colour and text: 3, 5 amber · 6, 11 orange · 12, 14 red', () => {
    const months = [3, 5, 6, 11, 12, 14];
    api.list.and.returnValue(
      of(months.map((m, i) => longAbsenceFixture({ memberPublicId: `id-${i}`, absenceMonths: m }))),
    );
    const f = render();
    const badges = Array.from(el(f).querySelectorAll<HTMLElement>('[data-urgency]'));
    expect(badges.map(b => b.dataset['urgency'])).toEqual([
      'urgency-3', 'urgency-3', 'urgency-6', 'urgency-6', 'urgency-12', 'urgency-12',
    ]);
    expect(badges.map(b => b.textContent?.trim())).toEqual([
      '3개월 · 3개월+', '5개월 · 3개월+', '6개월 · 6개월+', '11개월 · 6개월+', '12개월 · 12개월+', '14개월 · 12개월+',
    ]);
    const span = badges[5].querySelector('app-badge span') as HTMLElement;
    expect(span.style.background).toContain('--color-badge-urgency-red-bg');
  });

  it('switches filters without asking the server again, and keeps the total', () => {
    const f = render();
    f.componentInstance.onFilterChange('done');
    f.detectChanges();
    expect(all(f, 'long-absent-name').map(n => n.textContent?.trim())).toEqual(['Max Mustermann']);
    expect(one(f, 'long-absent-total')?.textContent).toContain('전체 3명');
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.summary).toHaveBeenCalledTimes(1);
  });

  it('shows who contacted and when, and no phone number anywhere', () => {
    const f = render();
    f.componentInstance.onFilterChange('all');
    f.detectChanges();
    const by = one(f, 'long-absent-contacted-by')?.textContent ?? '';
    expect(by).toContain('Max Mustermann');
    expect(by).toContain('2026');
    expect(el(f).textContent).not.toMatch(/\+49|010-/);
  });

  it('keeps empty, filtered-empty, error and forbidden apart', () => {
    api.list.and.returnValue(of([]));
    let f = render();
    expect(one(f, 'long-absent-empty')).not.toBeNull();
    f.destroy();

    api.list.and.returnValue(of([longAbsenceFixture({ contacted: true })]));
    f = render();
    expect(one(f, 'long-absent-no-results')).not.toBeNull();
    expect(one(f, 'long-absent-total')?.textContent).toContain('전체 1명');
    f.destroy();

    api.list.and.returnValue(throwError(() => httpError(500)));
    f = render();
    expect(one(f, 'long-absent-error')).not.toBeNull();
    api.list.and.returnValue(of(longAbsenceListFixture()));
    (one(f, 'long-absent-error')?.querySelector('button') as HTMLButtonElement).click();
    f.detectChanges();
    expect(all(f, 'long-absent-name').length).toBe(2);
    f.destroy();

    api.list.and.returnValue(throwError(() => httpError(403)));
    f = render();
    expect(one(f, 'long-absent-forbidden')).not.toBeNull();
    expect(all(f, 'long-absent-name').length).toBe(0);
  });

  it('shows the loading state until the list arrives', () => {
    const pending = new Subject<LongAbsence[]>();
    api.list.and.returnValue(pending);
    const f = render();
    expect(one(f, 'long-absent-loading')).not.toBeNull();
    pending.next([]);
    f.detectChanges();
    expect(one(f, 'long-absent-loading')).toBeNull();
  });

  it('marks a person as contacted and refreshes list and tab counter', () => {
    const f = render();
    const row = f.componentInstance.state.visibleRows()[0];
    api.setContactStatus.and.returnValue(of({ ...row, contacted: true, version: 1 }));
    api.summary.and.returnValue(of(longAbsenceSummaryFixture({ uncontactedCount: 1 })));
    all(f, 'long-absent-mark')[0].querySelector('button')?.click();
    f.detectChanges();
    expect(api.setContactStatus).toHaveBeenCalledWith(row.memberPublicId, {
      lastSundayDate: row.lastSundayDate,
      version: row.version,
      contacted: true,
    });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(api.summary).toHaveBeenCalledTimes(2);
    expect(one(f, 'tab-count')?.textContent).toContain('1');
  });

  describe('undo contact', () => {
    function openUndo(): ComponentFixture<LongAbsentPageComponent> {
      const f = render();
      f.componentInstance.onFilterChange('done');
      f.detectChanges();
      one(f, 'long-absent-undo')?.querySelector('button')?.click();
      f.detectChanges();
      return f;
    }

    it('keeps the memo when nothing is added — no memoUpdate at all', () => {
      const f = openUndo();
      const row = f.componentInstance.undoRow()!;
      api.setContactStatus.and.returnValue(of({ ...row, contacted: false, version: 3 }));
      (document.querySelector('[data-testid="undo-confirm"] button') as HTMLButtonElement).click();
      f.detectChanges();
      const body = api.setContactStatus.calls.mostRecent().args[1];
      expect(body).toEqual({ lastSundayDate: row.lastSundayDate, version: row.version, contacted: false });
      expect(f.componentInstance.undoRow()).toBeNull();
    });

    it('sends the existing memo plus the new details atomically', () => {
      const f = openUndo();
      const row = f.componentInstance.undoRow()!;
      api.setContactStatus.and.returnValue(of({ ...row, contacted: false }));
      const textarea = document.querySelector('[data-testid="undo-details"]') as HTMLTextAreaElement;
      textarea.value = '다음 달 복귀 예정';
      textarea.dispatchEvent(new Event('input'));
      f.detectChanges();
      (document.querySelector('[data-testid="undo-confirm"] button') as HTMLButtonElement).click();
      expect(api.setContactStatus.calls.mostRecent().args[1].memoUpdate).toEqual({
        value: '직장 때문에 이사\n다음 달 복귀 예정',
      });
    });

    it('blocks an addition that pushes the memo past 2,000 units, separator included', () => {
      const f = openUndo();
      const existing = f.componentInstance.undoRow()!.memo!;
      const textarea = document.querySelector('[data-testid="undo-details"]') as HTMLTextAreaElement;
      textarea.value = 'x'.repeat(2000 - existing.length - 1);
      textarea.dispatchEvent(new Event('input'));
      f.detectChanges();
      expect(document.querySelector('[data-testid="undo-too-long"]')).toBeNull();
      textarea.value += 'x';
      textarea.dispatchEvent(new Event('input'));
      f.detectChanges();
      expect(document.querySelector('[data-testid="undo-too-long"]')).not.toBeNull();
      (document.querySelector('[data-testid="undo-confirm"] button') as HTMLButtonElement).click();
      expect(api.setContactStatus).not.toHaveBeenCalled();
    });

    it('sends nothing on cancel', () => {
      const f = openUndo();
      f.componentInstance.closeDialogs();
      f.detectChanges();
      expect(api.setContactStatus).not.toHaveBeenCalled();
      expect(f.componentInstance.undoRow()).toBeNull();
    });
  });

  describe('memo', () => {
    function openMemo(index = 0): ComponentFixture<LongAbsentPageComponent> {
      const f = render();
      f.componentInstance.onFilterChange('all');
      f.detectChanges();
      all(f, 'long-absent-edit-memo')[index].click();
      f.detectChanges();
      return f;
    }

    function type(f: ComponentFixture<LongAbsentPageComponent>, value: string): void {
      const textarea = document.querySelector('[data-testid="memo-input"]') as HTMLTextAreaElement;
      textarea.value = value;
      textarea.dispatchEvent(new Event('input'));
      f.detectChanges();
    }

    const save = () => (document.querySelector('[data-testid="memo-save"] button') as HTMLButtonElement);

    it('opens with the current memo, the limit and the privacy hint', () => {
      const f = openMemo(1);
      expect((document.querySelector('[data-testid="memo-input"]') as HTMLTextAreaElement).value).toBe('직장 때문에 이사');
      expect(document.querySelector('[data-testid="memo-count"]')?.textContent).toContain('/ 2000');
      expect(dialogText()).toContain('statistics.longAbsent.memoDialog.privacy');
      expect(f.componentInstance.memoRow()?.fullName).toBe('Max Mustermann');
    });

    for (const [length, ok] of [[1999, true], [2000, true], [2001, false]] as const) {
      it(`${ok ? 'accepts' : 'refuses'} ${length} UTF-16 units without cutting`, () => {
        const f = openMemo();
        type(f, 'a'.repeat(length));
        expect((document.querySelector('[data-testid="memo-input"]') as HTMLTextAreaElement).value.length).toBe(length);
        expect(save().disabled).toBe(!ok);
        expect(document.querySelector('[data-testid="memo-too-long"]') !== null).toBe(!ok);
      });
    }

    it('counts an emoji as two units', () => {
      const f = openMemo();
      type(f, 'a'.repeat(1999) + '🙏');
      expect(document.querySelector('[data-testid="memo-count"]')?.textContent).toContain('2001');
      expect(save().disabled).toBeTrue();
    });

    it('refuses an over-long blank text too', () => {
      const f = openMemo();
      type(f, ' '.repeat(2001));
      expect(save().disabled).toBeTrue();
    });

    it('saves the text as typed', () => {
      const f = openMemo();
      const row = f.componentInstance.memoRow()!;
      api.setMemo.and.returnValue(of({ ...row, memo: '이사', version: 1 }));
      type(f, '이사');
      save().click();
      f.detectChanges();
      expect(api.setMemo).toHaveBeenCalledWith(row.memberPublicId, {
        lastSundayDate: row.lastSundayDate,
        version: row.version,
        memo: '이사',
      });
      expect(f.componentInstance.memoRow()).toBeNull();
    });

    it('clears on purpose with null', () => {
      const f = openMemo(1);
      const row = f.componentInstance.memoRow()!;
      api.setMemo.and.returnValue(of({ ...row, memo: null }));
      type(f, '   ');
      save().click();
      expect(api.setMemo.calls.mostRecent().args[1].memo).toBeNull();
    });

    it('keeps the draft open after a 400/5xx for a deliberate retry', () => {
      const f = openMemo();
      api.setMemo.and.returnValue(throwError(() => httpError(500)));
      type(f, '초안');
      save().click();
      f.detectChanges();
      expect(f.componentInstance.memoRow()).not.toBeNull();
      expect((document.querySelector('[data-testid="memo-input"]') as HTMLTextAreaElement).value).toBe('초안');
      expect(api.setMemo).toHaveBeenCalledTimes(1);
    });

    it('keeps the draft readable on 409 (#279 AK 5), reloads and never resends it', () => {
      const f = openMemo();
      api.setMemo.and.returnValue(throwError(() => httpError(409, 'LONG_ABSENCE_NOT_CURRENT')));
      type(f, '초안');
      save().click();
      f.detectChanges();
      expect(f.componentInstance.memoRow()).not.toBeNull();
      expect(f.componentInstance.dialogConflict()).toBeTrue();
      const input = document.body.querySelector<HTMLTextAreaElement>('[data-testid="memo-input"]');
      expect(input?.value).toBe('초안');
      expect(input?.readOnly).toBeTrue();
      expect(document.body.querySelector('[data-testid="memo-conflict"]')).not.toBeNull();
      expect(document.body.querySelector('[data-testid="memo-save"]')).toBeNull();
      expect(api.setMemo).toHaveBeenCalledTimes(1);
      expect(api.list).toHaveBeenCalledTimes(2);
      expect(api.summary).toHaveBeenCalledTimes(2);

      f.componentInstance.closeDialogs();
      f.detectChanges();
      expect(f.componentInstance.memoRow()).toBeNull();
      expect(f.componentInstance.dialogConflict()).toBeFalse();
      expect(api.setMemo).toHaveBeenCalledTimes(1);
    });

    it('drops people, memo and draft on 403', () => {
      const f = openMemo(1);
      api.setMemo.and.returnValue(throwError(() => httpError(403)));
      type(f, '초안');
      save().click();
      f.detectChanges();
      expect(f.componentInstance.memoRow()).toBeNull();
      expect(one(f, 'long-absent-forbidden')).not.toBeNull();
      expect(el(f).textContent).not.toContain('직장 때문에 이사');
    });
  });

  it('turns rows into cards below the desktop breakpoint, with the actions underneath', () => {
    desktop.set(false);
    const f = render();
    const cards = all(f, 'long-absent-card');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('[data-testid="long-absent-mark"]')).not.toBeNull();
    expect(cards[0].querySelector('[data-urgency="urgency-12"]')).not.toBeNull();
  });

  it('keeps memos out of storage and the URL', () => {
    const f = render();
    f.componentInstance.onFilterChange('all');
    f.detectChanges();
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain('직장 때문에 이사');
    expect(location.href).not.toContain('memo');
  });

  describe('복귀 and history (#279)', () => {
    const confirmButton = () => document.body.querySelector('[data-testid="return-confirm"] button') as HTMLButtonElement;

    function openReturn(): ComponentFixture<LongAbsentPageComponent> {
      const f = render();
      all(f, 'long-absent-return')[0].querySelector('button')?.click();
      f.detectChanges();
      return f;
    }

    it('loads the history of closed phases on open, without memos', () => {
      api.history.and.returnValue(of(pageFixture([longAbsenceHistoryItemFixture()])));
      const f = render();
      expect(api.history).toHaveBeenCalledOnceWith(0);
      expect(all(f, 'long-absent-history-name').map(n => n.textContent?.trim())).toEqual(['홍길동']);
      expect(one(f, 'long-absent-history-end')?.textContent).toContain('statistics.longAbsent.history.endReason.MANUAL_RETURN');
      expect(one(f, 'long-absent-history-returned-by')?.textContent).toContain('Max Mustermann');
      expect(one(f, 'long-absent-history')?.textContent).not.toContain('직장 때문에 이사');
    });

    it('keeps history empty and error apart from the current list', () => {
      let f = render();
      expect(one(f, 'long-absent-history-empty')).not.toBeNull();
      f.destroy();
      api.history.and.returnValue(throwError(() => httpError(500)));
      f = render();
      expect(one(f, 'long-absent-history-error')).not.toBeNull();
      expect(all(f, 'long-absent-name').length).toBe(2);
    });

    it('asks for confirmation only, then drops the person and refreshes list, counter and history', () => {
      const f = openReturn();
      const row = f.componentInstance.returnRow()!;
      expect(document.body.querySelector('[data-testid="return-dialog"]')).not.toBeNull();
      expect(document.body.querySelector('.p-dialog textarea')).toBeNull();
      expect(api.markReturned).not.toHaveBeenCalled();

      api.markReturned.and.returnValue(of(longAbsenceReturnFixture({ memberPublicId: row.memberPublicId })));
      api.list.and.returnValue(of(longAbsenceListFixture().filter(r => r.memberPublicId !== row.memberPublicId)));
      api.summary.and.returnValue(of(longAbsenceSummaryFixture({ uncontactedCount: 1, totalCount: 2 })));
      api.history.and.returnValue(of(pageFixture([longAbsenceHistoryItemFixture({ memberPublicId: row.memberPublicId, fullName: row.fullName })])));
      confirmButton().click();
      f.detectChanges();

      expect(api.markReturned).toHaveBeenCalledOnceWith(row.memberPublicId, { lastSundayDate: row.lastSundayDate, version: row.version });
      expect(f.componentInstance.returnRow()).toBeNull();
      expect(all(f, 'long-absent-name').map(n => n.textContent?.trim())).not.toContain(row.fullName);
      expect(one(f, 'tab-count')?.textContent).toContain('1');
      expect(api.history).toHaveBeenCalledTimes(2);
      expect(all(f, 'long-absent-history-name').map(n => n.textContent?.trim())).toContain(row.fullName);
    });

    it('a parallel return (409) closes the dialog, reloads and does not retry', () => {
      const f = openReturn();
      api.markReturned.and.returnValue(throwError(() => httpError(409, 'LONG_ABSENCE_VERSION_CONFLICT')));
      confirmButton().click();
      f.detectChanges();
      expect(api.markReturned).toHaveBeenCalledTimes(1);
      expect(f.componentInstance.returnRow()).toBeNull();
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('a failed return keeps the dialog for a deliberate retry', () => {
      const f = openReturn();
      api.markReturned.and.returnValue(throwError(() => httpError(500)));
      confirmButton().click();
      f.detectChanges();
      expect(f.componentInstance.returnRow()).not.toBeNull();
      expect(api.list).toHaveBeenCalledTimes(1);
    });

    it('hides 복귀 for read-only roles and history for phases the server has not stored', () => {
      TestBed.inject(AuthService).roles.set(['leader']);
      const f = render();
      expect(all(f, 'long-absent-return').length).toBe(0);
      f.componentInstance.onFilterChange('all');
      f.detectChanges();
      // Only Max Mustermann has a stored phase in the fixture.
      expect(all(f, 'long-absent-current-history').length).toBe(1);
    });

    it('opens the panel of a past phase with its memo and changes; an empty memo is just empty', () => {
      const item = longAbsenceHistoryItemFixture();
      api.history.and.returnValue(of(pageFixture([item])));
      api.phase.and.returnValue(of(longAbsencePhaseFixture({ memo: null })));
      api.changes.and.returnValue(
        of(pageFixture([
          longAbsenceChangeFixture({ memo: null }),
          longAbsenceChangeFixture({ publicId: 'c2', kind: 'CONTACT_CHANGED', contacted: true, memo: null, origin: 'LEGACY_SNAPSHOT', occurredAt: null, actorSubject: null, actorMember: null }),
        ])),
      );
      const f = render();
      one(f, 'long-absent-history-open')?.querySelector('button')?.click();
      f.detectChanges();
      expect(api.phase).toHaveBeenCalledOnceWith(item.memberPublicId, item.phasePublicId);
      const panel = document.body.querySelector('[data-testid="history-panel"]');
      expect(panel?.querySelector('[data-testid="panel-memo-empty"]')).not.toBeNull();
      expect(panel?.textContent).not.toMatch(/삭제|deleted/i);
      expect(panel?.querySelectorAll('[data-testid="panel-change"]').length).toBe(2);
      expect(panel?.textContent).toContain('statistics.longAbsent.panel.unknownTime');

      f.componentInstance.closePanel();
      f.detectChanges();
      expect(f.componentInstance.phase.isOpen()).toBeFalse();
      expect(f.componentInstance.phase.phase()).toBeNull();
    });

    it('a memo saved while the panel shows that person re-reads the panel', () => {
      const f = render();
      f.componentInstance.onFilterChange('all');
      f.detectChanges();
      api.phase.and.returnValue(of(longAbsencePhaseFixture({ isCurrent: true })));
      api.changes.and.returnValue(of(pageFixture([longAbsenceChangeFixture()])));
      one(f, 'long-absent-current-history')?.querySelector('button')?.click();
      f.detectChanges();
      const row = f.componentInstance.state.rows().find(r => r.phasePublicId)!;
      api.setMemo.and.returnValue(of({ ...row, memo: null, version: row.version + 1 }));
      api.phase.and.returnValue(of(longAbsencePhaseFixture({ isCurrent: true, memo: null })));
      api.changes.and.returnValue(of(pageFixture([longAbsenceChangeFixture({ memo: null })])));
      f.componentInstance.memoRow.set(row);
      f.componentInstance.saveMemo(null);
      f.detectChanges();
      expect(api.phase).toHaveBeenCalledTimes(2);
      expect(f.componentInstance.phase.phase()?.memo).toBeNull();
      expect(f.componentInstance.phase.changes().map(c => c.memo)).toEqual([null]);
    });

    it('a 403 from the history drops the whole page', () => {
      api.history.and.returnValue(throwError(() => httpError(403)));
      const f = render();
      expect(one(f, 'long-absent-forbidden')).not.toBeNull();
      expect(all(f, 'long-absent-name').length).toBe(0);
    });
  });
});
