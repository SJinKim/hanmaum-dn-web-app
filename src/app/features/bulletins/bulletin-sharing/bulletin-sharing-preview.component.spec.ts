import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { BulletinSharingBlock } from '../bulletins.model';
import { BulletinSharingPreviewComponent } from './bulletin-sharing-preview.component';

describe('BulletinSharingPreviewComponent (#193)', () => {
  function setup(blocks: BulletinSharingBlock[]) {
    TestBed.configureTestingModule({ imports: [BulletinSharingPreviewComponent], providers: [provideTranslateService()] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { bulletins: { sharing: { questionNumber: 'Question {{n}}' } } });
    translate.use('en');
    const fixture = TestBed.createComponent(BulletinSharingPreviewComponent);
    fixture.componentRef.setInput('blocks', blocks);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('renders ordered typed blocks, references and consecutive question numbers', () => {
    const { el } = setup([
      { type: 'HEADING', text: 'Heading' }, { type: 'QUESTION', text: 'First?' },
      { type: 'PARAGRAPH', text: 'Line one\nLine two' },
      { type: 'SCRIPTURE', text: 'Verse', reference: 'John 15:1' }, { type: 'QUESTION', text: 'Second?' },
    ]);
    expect(el.querySelector('h4')?.textContent).toBe('Heading');
    expect(el.querySelector('blockquote')?.textContent).toContain('John 15:1');
    const questions = Array.from(el.querySelectorAll('[data-testid="sharing-preview-question"]')).map(n => n.textContent);
    expect(questions[0]).toContain('Question 1');
    expect(questions[1]).toContain('Question 2');
    expect(el.textContent).toContain('Line one\nLine two');
  });

  it('updates from unsaved content and never interprets text as HTML', () => {
    const { fixture, el } = setup([{ type: 'PARAGRAPH', text: 'Old' }]);
    fixture.componentRef.setInput('blocks', [{ type: 'PARAGRAPH', text: '<img src=x onerror=alert(1)>' }]);
    fixture.detectChanges();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
  });

  it('explains that an empty section is hidden in the member app', () => {
    const { el } = setup([]);
    expect(el.querySelector('[data-testid="sharing-preview"]')).toBeNull();
    expect(el.querySelector('[data-testid="sharing-preview-hidden"]')).not.toBeNull();
  });
});
