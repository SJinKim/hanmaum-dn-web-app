import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { RoleService } from '../../../core/services/role.service';
import { BulletinEdition } from '../bulletins.model';
import { BulletinsService } from '../bulletins.service';
import { BulletinEditorComponent } from './bulletin-editor.component';

function edition(overrides: Partial<BulletinEdition> = {}): BulletinEdition {
  return {
    publicId: 'b1',
    serviceDate: '2099-10-11',
    volume: null,
    status: 'DRAFT',
    servicePublicId: 's1',
    serviceName: '주일 예배',
    serviceStartTime: '14:00:00',
    openingPrayerBy: '홍길동',
    offeringSongBy: null,
    scriptureReference: '요 3:16',
    sermonTitle: '말씀',
    sermonPreacher: '홍길동',
    responsePrayerBy: null,
    responseSong: null,
    songs: ['찬양 1', '찬양 2'],
    announcements: [{ title: '소식', body: null }],
    sharingBlocks: [{ type: 'PARAGRAPH', text: '나눔' }],
    sectionTitles: [{ key: 'SECTION_WORSHIP', title: '예배로 나아감', defaultTitle: '예배로 나아감' }],
    publishedAt: null,
    withdrawnAt: null,
    version: 3,
    ...overrides,
  };
}

describe('BulletinEditorComponent — 주보 편집 (#36)', () => {
  let service: jasmine.SpyObj<BulletinsService>;

  function setup(options: { canWrite?: boolean; edition?: BulletinEdition; fail?: boolean } = {}) {
    service = jasmine.createSpyObj<BulletinsService>('BulletinsService', ['get', 'update', 'publish', 'withdraw']);
    service.get.and.returnValue(
      options.fail ? throwError(() => new HttpErrorResponse({ status: 404 })) : of(options.edition ?? edition()),
    );

    TestBed.configureTestingModule({
      imports: [BulletinEditorComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: BulletinsService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ publicId: 'b1' }) } } },
        { provide: RoleService, useValue: { canWrite: () => options.canWrite ?? true, hasAnyRole: () => true, isAdmin: () => true } },
      ],
    });
    const fixture = TestBed.createComponent(BulletinEditorComponent);
    fixture.detectChanges();
    const messages = fixture.debugElement.injector.get(MessageService);
    spyOn(messages, 'add');
    const confirmations = fixture.debugElement.injector.get(ConfirmationService);
    spyOn(confirmations, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmations;
    });
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, component: fixture.componentInstance, messages, el };
  }

  it('loads the edition into the form and the preview', () => {
    const { el, component } = setup();
    expect(service.get).toHaveBeenCalledWith('b1');
    expect((el.querySelector('[data-testid="field-sermonTitle"]') as HTMLInputElement).value).toBe('말씀');
    expect(component.previewSongs()).toEqual(['찬양 1', '찬양 2']);
    expect(el.querySelector('[data-testid="preview"]')).not.toBeNull();
  });

  it('shows the empty state when the edition is not found', () => {
    const { el, component } = setup({ fail: true });
    expect(component.notFound()).toBeTrue();
    expect(el.querySelector('app-empty-state')).not.toBeNull();
  });

  it('builds a trimmed request with blanks as null and empty rows dropped', () => {
    const { component } = setup();
    component.setField('offeringSongBy', '  ');
    component.setField('sermonTitle', '  새 말씀 ');
    component.addSong();
    component.setSong(0, ' 찬양 1 ');
    component.addAnnouncement();
    component.setAnnouncement(0, 'body', '  ');

    const req = component.buildRequest()!;
    expect(req.version).toBe(3);
    expect(req.offeringSongBy).toBeNull();
    expect(req.sermonTitle).toBe('새 말씀');
    expect(req.songs).toEqual(['찬양 1', '찬양 2']);
    expect(req.announcements).toEqual([{ title: '소식', body: null }]);
    expect(req.sharingBlocks).toEqual([{ type: 'PARAGRAPH', text: '나눔' }]);
  });

  it('adds, moves and removes songs within the limit', () => {
    const { component } = setup({ edition: edition({ songs: ['1', '2', '3', '4', '5', '6', '7'] }) });
    component.moveSong(0, 1);
    expect(component.draft()!.songs.slice(0, 2)).toEqual(['2', '1']);
    component.moveSong(0, -1);
    expect(component.draft()!.songs[0]).toBe('2');
    component.addSong();
    component.addSong();
    expect(component.draft()!.songs.length).toBe(8);
    component.removeSong(0);
    expect(component.draft()!.songs[0]).toBe('1');
    expect(component.dirty()).toBeTrue();
  });

  it('saves with PUT and applies the new version', () => {
    const { component, messages } = setup();
    service.update.and.returnValue(of(edition({ version: 4, sermonTitle: '새 말씀' })));
    component.setField('sermonTitle', '새 말씀');
    component.save();

    expect(service.update).toHaveBeenCalledWith('b1', jasmine.objectContaining({ version: 3, sermonTitle: '새 말씀' }));
    expect(component.edition()!.version).toBe(4);
    expect(component.dirty()).toBeFalse();
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
  });

  it('shows the conflict banner on a 409 and keeps the input', () => {
    const { component, fixture, el } = setup();
    service.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    component.setField('sermonTitle', '내 입력');
    component.save();
    fixture.detectChanges();

    expect(component.conflict()).toBeTrue();
    expect(component.draft()!.sermonTitle).toBe('내 입력');
    expect(el.querySelector('[data-testid="editor-conflict"]')).not.toBeNull();

    component.reload();
    expect(component.conflict()).toBeFalse();
    expect(component.draft()!.sermonTitle).toBe('말씀');
  });

  it('saves unsaved input before publishing', () => {
    const { component } = setup();
    service.update.and.returnValue(of(edition({ version: 4 })));
    service.publish.and.returnValue(of(edition({ version: 5, status: 'PUBLISHED', volume: 12 })));
    component.setField('responseSong', '응답 찬양');
    component.confirmPublish();

    expect(service.update).toHaveBeenCalled();
    expect(service.publish).toHaveBeenCalledWith('b1');
    expect(component.published()).toBeTrue();
  });

  it('publishes without a PUT when nothing changed', () => {
    const { component } = setup();
    service.publish.and.returnValue(of(edition({ status: 'PUBLISHED', volume: 12 })));
    component.confirmPublish();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.publish).toHaveBeenCalled();
  });

  it('marks the fields a 422 BULLETIN_INCOMPLETE names', () => {
    const { component, fixture, el } = setup();
    service.publish.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 422,
      error: { code: 'BULLETIN_INCOMPLETE', fieldErrors: { sermonPreacher: '필수', songs: '필수' } },
    })));
    component.confirmPublish();
    fixture.detectChanges();

    expect(component.isMissing('sermonPreacher')).toBeTrue();
    expect(component.isMissing('songs')).toBeTrue();
    expect(component.isMissing('sermonTitle')).toBeFalse();
    expect(el.querySelector('[data-testid="missing-sermonPreacher"]')).not.toBeNull();

    component.setField('sermonPreacher', '홍길동');
    expect(component.isMissing('sermonPreacher')).toBeFalse();
  });

  it('is read-only when published and offers 발행 취소', () => {
    const { component, fixture, el } = setup({ edition: edition({ status: 'PUBLISHED', volume: 12 }) });
    expect(component.readOnly()).toBeTrue();
    expect(el.querySelector('[data-testid="editor-readonly"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="editor-save"]')).toBeNull();

    component.setField('sermonTitle', '바뀜');
    expect(component.dirty()).toBeFalse();

    service.withdraw.and.returnValue(of(edition({ status: 'WITHDRAWN', volume: 12 })));
    component.confirmWithdraw();
    fixture.detectChanges();
    expect(service.withdraw).toHaveBeenCalledWith('b1');
    expect(component.readOnly()).toBeFalse();
  });

  it('is read-only without write access', () => {
    const { component } = setup({ canWrite: false });
    expect(component.readOnly()).toBeTrue();
    component.save();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('opens the sharing tab and saves unsaved ordered blocks without editor IDs', () => {
    const { component, fixture, el } = setup();
    component.activeTab.set(1);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="tab-sharing"]')?.getAttribute('aria-disabled')).not.toBe('true');
    component.setSharingBlocks([
      { editorId: 10, type: 'QUESTION', text: ' First? ' },
      { editorId: 11, type: 'SCRIPTURE', text: ' Verse ', reference: ' John 15:1 ' },
      { editorId: 12, type: 'PARAGRAPH', text: 'One\nTwo' },
    ]);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="sharing-preview"]')?.textContent).toContain('First?');
    expect(component.buildRequest()!.sharingBlocks).toEqual([
      { type: 'QUESTION', text: 'First?' },
      { type: 'SCRIPTURE', text: 'Verse', reference: 'John 15:1' },
      { type: 'PARAGRAPH', text: 'One\nTwo' },
    ]);
    service.update.and.returnValue(of(edition({ sharingBlocks: component.buildRequest()!.sharingBlocks, version: 4 })));
    component.save();
    expect(service.update.calls.mostRecent().args[1].sharingBlocks[0]).toEqual({ type: 'QUESTION', text: 'First?' });
    expect(component.dirty()).toBeFalse();
  });

  it('blocks saving and publishing invalid sharing content, exposes inline errors and preserves all input', () => {
    const { component, fixture, el } = setup();
    component.setSharingBlocks([{ editorId: 0, type: 'QUESTION', text: ' ' }]);
    component.setField('sermonTitle', 'Unsaved sermon');
    component.save();
    component.confirmPublish();
    fixture.detectChanges();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.publish).not.toHaveBeenCalled();
    expect(component.activeTab()).toBe(0);
    expect(el.querySelector('[data-testid="sharing-tab-error"]')).not.toBeNull();
    component.activeTab.set(1);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="sharing-text-error"]')).not.toBeNull();
    expect(component.draft()!.sermonTitle).toBe('Unsaved sermon');
    for (const block of [
      { editorId: 0, type: 'PARAGRAPH' as const, text: 'x'.repeat(2001) },
      { editorId: 0, type: 'SCRIPTURE' as const, text: 'Verse', reference: 'x'.repeat(101) },
    ]) {
      component.setSharingBlocks([block]);
      component.save();
      expect(service.update).not.toHaveBeenCalled();
    }
  });

  it('validates the trimmed payload and clears the tab error after correction', () => {
    const { component } = setup();
    component.setSharingBlocks([{ editorId: 0, type: 'QUESTION', text: '' }]);
    component.save();
    expect(component.sharingInvalid()).toBeTrue();
    component.setSharingBlocks([
      { editorId: 1, type: 'SCRIPTURE', text: ' ' + 'x'.repeat(2000) + ' ', reference: ' ' },
      { editorId: 2, type: 'PARAGRAPH', text: 'Text', reference: 'Ignored' },
    ]);
    expect(component.sharingInvalid()).toBeFalse();
    expect(component.buildRequest()!.sharingBlocks).toEqual([
      { type: 'SCRIPTURE', text: 'x'.repeat(2000), reference: null },
      { type: 'PARAGRAPH', text: 'Text' },
    ]);
  });

  it('allows removing all blocks and saves the empty list before publishing', () => {
    const { component } = setup();
    component.setSharingBlocks([]);
    service.update.and.returnValue(of(edition({ sharingBlocks: [], version: 4 })));
    service.publish.and.returnValue(of(edition({ sharingBlocks: [], status: 'PUBLISHED', version: 5 })));
    component.confirmPublish();
    expect(service.update.calls.mostRecent().args[1].sharingBlocks).toEqual([]);
    expect(service.publish).toHaveBeenCalledWith('b1');
  });

  it('accepts the exact contract limits and rejects a fifty-first block', () => {
    const { component } = setup();
    const blocks = Array.from({ length: 50 }, (_, editorId) => ({
      editorId, type: 'SCRIPTURE' as const, text: 'x'.repeat(2000), reference: 'r'.repeat(100),
    }));
    component.setSharingBlocks(blocks);
    service.update.and.returnValue(of(edition({ sharingBlocks: component.buildRequest()!.sharingBlocks, version: 4 })));
    component.save();
    expect(service.update.calls.count()).toBe(1);
    component.setSharingBlocks([...blocks, { editorId: 50, type: 'QUESTION', text: 'Too many' }]);
    component.save();
    expect(service.update.calls.count()).toBe(1);
    expect(component.sharingValidationShown()).toBeTrue();
  });

  it('keeps sharing changes after a save failure or version conflict, then reloads server blocks', () => {
    const { component } = setup();
    const blocks = [{ editorId: 0, type: 'QUESTION' as const, text: 'Unsaved?' }];
    component.setSharingBlocks(blocks);
    for (const status of [500, 409]) {
      service.update.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      component.save();
      expect(component.draft()!.sharingBlocks).toEqual(blocks);
      expect(component.dirty()).toBeTrue();
    }
    component.reload();
    expect(component.draft()!.sharingBlocks[0].text).toBe('나눔');
    expect(component.dirty()).toBeFalse();
  });

  it('does not mutate loaded API objects and guards sharing edits while read-only or saving', () => {
    const original = edition();
    const { component } = setup({ edition: original });
    component.setSharingBlocks([{ editorId: 0, type: 'QUESTION', text: 'Changed' }]);
    expect(original.sharingBlocks).toEqual([{ type: 'PARAGRAPH', text: '나눔' }]);
    component.busy.set(true);
    component.setSharingBlocks([]);
    expect(component.draft()!.sharingBlocks.length).toBe(1);
    component.busy.set(false);
    component.edition.set(edition({ status: 'PUBLISHED' }));
    component.setSharingBlocks([]);
    expect(component.draft()!.sharingBlocks[0].text).toBe('Changed');
  });
});
