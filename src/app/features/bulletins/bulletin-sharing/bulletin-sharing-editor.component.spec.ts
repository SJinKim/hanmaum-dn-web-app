import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { By } from '@angular/platform-browser';
import { BulletinSharingEditorComponent } from './bulletin-sharing-editor.component';
import { BulletinSharingDraftBlock } from './bulletin-sharing.model';

@Component({
  standalone: true,
  imports: [BulletinSharingEditorComponent],
  template: '<app-bulletin-sharing-editor [blocks]="blocks()" [disabled]="disabled()" [showValidation]="validate()" [resetVersion]="resetVersion()" (blocksChange)="blocks.set($event)" />',
})
class HostComponent {
  readonly blocks = signal<BulletinSharingDraftBlock[]>([]);
  readonly disabled = signal(false);
  readonly validate = signal(false);
  readonly resetVersion = signal(0);
}

describe('BulletinSharingEditorComponent (#193)', () => {
  function setup(blocks: BulletinSharingDraftBlock[] = []) {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [
      provideNoopAnimations(), provideTranslateService({ fallbackLang: 'en' }),
    ] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { bulletins: { sharing: {
      types: { HEADING: 'Heading', PARAGRAPH: 'Paragraph', SCRIPTURE: 'Scripture', QUESTION: 'Question' },
      questionNumber: 'Question {{n}}', moved: 'Block {{block}} moved to {{position}} of {{count}}.',
      fieldLabel: '{{label}} (block {{n}})', removed: 'Block {{position}} removed. {{count}} remain.',
    } } });
    translate.use('en');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.blocks.set(blocks);
    fixture.detectChanges();
    const editor = fixture.debugElement.query(By.directive(BulletinSharingEditorComponent)).componentInstance as BulletinSharingEditorComponent;
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, editor, el };
  }

  it('adds each chosen type and exposes a reference only for Scripture', () => {
    const { el, host, fixture } = setup();
    for (const type of ['HEADING', 'PARAGRAPH', 'SCRIPTURE', 'QUESTION']) {
      (el.querySelector(`[data-add-type="${type}"] button`) as HTMLButtonElement).click();
      fixture.detectChanges();
    }
    expect(host.blocks().map(b => b.type)).toEqual(['HEADING', 'PARAGRAPH', 'SCRIPTURE', 'QUESTION']);
    expect(new Set(host.blocks().map(b => b.editorId)).size).toBe(4);
    expect(el.querySelectorAll('[data-testid="sharing-reference"]').length).toBe(1);
    expect(el.querySelector('input[data-testid="sharing-text"]')?.getAttribute('maxlength')).toBe('2000');
    const reference = el.querySelector<HTMLInputElement>('[data-testid="sharing-reference"]')!;
    reference.value = '요한복음 15:1';
    reference.dispatchEvent(new Event('input'));
    expect(host.blocks()[2].reference).toBe('요한복음 15:1');
  });

  it('renumbers questions across other types after keyboard reordering and deletion, preserving handle focus', async () => {
    const { fixture, host, editor, el } = setup([
      { editorId: 0, type: 'QUESTION', text: 'First' },
      { editorId: 1, type: 'HEADING', text: 'Heading' },
      { editorId: 2, type: 'QUESTION', text: 'Second' },
    ]);
    const handle = el.querySelector<HTMLElement>('[data-block-id="2"] [data-testid="sharing-handle"]')!;
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.blocks().map(b => b.text)).toEqual(['Second', 'First', 'Heading']);
    expect(document.activeElement).toBe(handle);
    expect(editor.rows().map(r => r.question)).toEqual([1, 2, null]);
    fixture.detectChanges();
    expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain('1 of 3');
    editor.remove(2);
    fixture.detectChanges();
    expect(editor.rows().map(r => r.question)).toEqual([1, null]);
  });

  it('reorders through the actual PrimeNG drag and drop directives', () => {
    const { fixture, host, el } = setup([
      { editorId: 0, type: 'PARAGRAPH', text: 'First' },
      { editorId: 1, type: 'HEADING', text: 'Second' },
      { editorId: 2, type: 'QUESTION', text: 'Third' },
    ]);
    const handle = el.querySelector<HTMLElement>('[data-block-id="0"] [data-testid="sharing-handle"]')!;
    const target = el.querySelector<HTMLElement>('[data-block-id="2"]')!;
    const dataTransfer = new DataTransfer();
    handle.dispatchEvent(new DragEvent('dragstart', { dataTransfer, bubbles: true }));
    target.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(host.blocks().map(b => b.text)).toEqual(['Second', 'Third', 'First']);
    handle.dispatchEvent(new DragEvent('dragend', { dataTransfer, bubbles: true }));
  });

  it('ignores out-of-range keyboard moves and cancelled or external drags', () => {
    const { editor, host, fixture } = setup([{ editorId: 0, type: 'QUESTION', text: 'Only' }]);
    editor.reorderKey(new KeyboardEvent('keydown', { key: 'ArrowUp' }), 0);
    editor.startDrag(0);
    editor.endDrag();
    editor.drop(0);
    fixture.detectChanges();
    expect(host.blocks().map(b => b.text)).toEqual(['Only']);
    expect(editor.announcement()).toBe('');
  });

  it('keeps inline validation attached to a block when it moves', () => {
    const { editor, fixture, el, host } = setup([
      { editorId: 0, type: 'PARAGRAPH', text: ' ' },
      { editorId: 1, type: 'SCRIPTURE', text: 'x'.repeat(2001), reference: 'r'.repeat(101) },
    ]);
    host.validate.set(true);
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-testid="sharing-text-error"]').length).toBe(2);
    expect(el.querySelectorAll('[data-testid="sharing-reference-error"]').length).toBe(1);
    editor.reorderKey(new KeyboardEvent('keydown', { key: 'Home' }), 1);
    editor.setField(0, 'text', 'Valid');
    fixture.detectChanges();
    expect(el.querySelector('[data-block-id="0"] [aria-invalid="true"]')).toBeNull();
    expect(el.querySelector('[data-block-id="1"] [data-testid="sharing-text-error"]')).not.toBeNull();
  });

  it('shows errors on blur, allows no more than fifty blocks, and supports removing the last block', () => {
    const { fixture, host, editor, el } = setup();
    editor.add('QUESTION');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="sharing-text-error"]')).toBeNull();
    el.querySelector<HTMLElement>('[data-testid="sharing-text"]')!.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="sharing-text-error"]')).not.toBeNull();
    host.blocks.set(Array.from({ length: 50 }, (_, editorId) => ({ editorId, type: 'QUESTION' as const, text: 'Q' })));
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-add-type] button:disabled').length).toBe(4);
    editor.add('HEADING');
    expect(host.blocks().length).toBe(50);
    host.blocks.set([{ editorId: 100, type: 'QUESTION', text: 'Last' }]);
    fixture.detectChanges();
    editor.remove(100);
    fixture.detectChanges();
    expect(el.querySelector('app-empty-state')).not.toBeNull();
  });

  it('disables all mutation routes for published editions, insufficient permissions or an active save', () => {
    const { host, editor, fixture, el } = setup([{ editorId: 0, type: 'QUESTION', text: 'Original' }]);
    host.disabled.set(true);
    fixture.detectChanges();
    editor.add('HEADING');
    editor.setField(0, 'text', 'Changed');
    editor.remove(0);
    editor.startDrag(0);
    editor.drop(0);
    editor.reorderKey(new KeyboardEvent('keydown', { key: 'End' }), 0);
    expect(host.blocks()).toEqual([{ editorId: 0, type: 'QUESTION', text: 'Original' }]);
    expect(el.querySelectorAll('[data-add-type]').length).toBe(0);
    expect(el.querySelector<HTMLInputElement>('[data-testid="sharing-text"]')!.disabled).toBeTrue();
  });

  it('restores removed content and clears stale validation on reload with reused IDs', () => {
    const { host, editor, fixture } = setup([{ editorId: 0, type: 'SCRIPTURE', text: 'Verse', reference: 'John 1' }]);
    editor.remove(0);
    fixture.detectChanges();
    expect(host.blocks()).toEqual([]);
    editor.undoRemove();
    fixture.detectChanges();
    expect(host.blocks()).toEqual([{ editorId: 0, type: 'SCRIPTURE', text: 'Verse', reference: 'John 1' }]);
    editor.touch(0, 'text');
    editor.startDrag(0);
    host.blocks.set([{ editorId: 0, type: 'QUESTION', text: '' }]);
    host.resetVersion.update(v => v + 1);
    fixture.detectChanges();
    expect(editor.error(host.blocks()[0], 'text')).toBeUndefined();
    expect(editor.removed()).toBeNull();
    expect(editor.announcement()).toBe('');
  });

  it('offers click sorting with boundary guards, unique accessible names and undo', async () => {
    const { host, fixture, el } = setup([
      { editorId: 0, type: 'QUESTION', text: 'First?' },
      { editorId: 1, type: 'QUESTION', text: 'Second?' },
    ]);
    expect(el.querySelector<HTMLButtonElement>('[data-block-id="0"] [data-testid="sharing-up"] button')!.disabled).toBeTrue();
    expect(el.querySelector<HTMLButtonElement>('[data-block-id="1"] [data-testid="sharing-down"] button')!.disabled).toBeTrue();
    expect(Array.from(el.querySelectorAll('[data-testid="sharing-text"]')).map(x => x.getAttribute('aria-label'))).toEqual(['Question 1', 'Question 2']);
    el.querySelector<HTMLButtonElement>('[data-block-id="1"] [data-testid="sharing-up"] button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.blocks().map(b => b.text)).toEqual(['Second?', 'First?']);
    el.querySelector<HTMLButtonElement>('[data-block-id="1"] [data-testid="sharing-remove"] button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[aria-live="polite"]')!.textContent).toContain('removed');
    el.querySelector<HTMLButtonElement>('[data-testid="sharing-undo"] button')!.click();
    fixture.detectChanges();
    expect(host.blocks().map(b => b.text)).toEqual(['Second?', 'First?']);
  });
});
