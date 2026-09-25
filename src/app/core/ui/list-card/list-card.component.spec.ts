import { TestBed } from '@angular/core/testing';

import { ListCardComponent } from './list-card.component';

describe('ListCardComponent', () => {
  function render(selectable?: boolean) {
    const fixture = TestBed.createComponent(ListCardComponent);
    fixture.componentRef.setInput('record', { id: 'm1', title: '김민수', subtitle: '팀장', meta: '23.03' });
    if (selectable !== undefined) fixture.componentRef.setInput('selectable', selectable);
    fixture.detectChanges();
    return fixture;
  }

  it('emits the record when the card is tapped', () => {
    const fixture = render();
    const emitted: string[] = [];
    fixture.componentInstance.selected.subscribe(r => emitted.push(r.id));
    fixture.nativeElement.querySelector('button').click();
    expect(emitted).toEqual(['m1']);
  });

  it('renders a read-only card without a button when not selectable', () => {
    const el: HTMLElement = render(false).nativeElement;
    expect(el.querySelector('button')).toBeNull();
    expect(el.textContent).toContain('김민수');
    expect(el.textContent).toContain('23.03');
  });
});
