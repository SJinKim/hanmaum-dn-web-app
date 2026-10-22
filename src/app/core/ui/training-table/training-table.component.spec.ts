import { TestBed } from '@angular/core/testing';
import { TrainingTableCell, TrainingTableComponent, TrainingTableDivision } from './training-table.component';

function cell(id: string, state: TrainingTableCell['state'] = 'default', interactive = false): TrainingTableCell {
  return { id, label: id, stage: 'qbs', stageLabel: '큐베세수료', state, interactive };
}

const DIVISIONS: TrainingTableDivision[] = [
  {
    key: 'NEHEMIA', heading: '느헤미야', spanHeader: false,
    columns: [
      { key: 'g1', name: '믿음', leader: null, cells: [cell('a'), cell('b'), cell('c')] },
      { key: 'g2', name: '소망', leader: null, cells: [cell('d', 'candidate', true)] },
    ],
  },
  {
    key: 'NEWCOMERS', heading: '새가족순', spanHeader: true,
    columns: [{ key: 'nf', name: '새가족', leader: null, cells: [cell('e', 'dimmed')] }],
  },
];

describe('TrainingTableComponent', () => {
  function render(mode: 'all' | 'single', divisions = DIVISIONS) {
    const fixture = TestBed.createComponent(TrainingTableComponent);
    fixture.componentRef.setInput('divisions', divisions);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('groupLabel', '순');
    fixture.componentRef.setInput('leaderLabel', '순장');
    fixture.detectChanges();
    return fixture;
  }

  it('pads every column to the longest one', () => {
    const el: HTMLElement = render('all').nativeElement;
    for (const key of ['g1', 'g2', 'nf']) {
      // 1 leader + 3 member rows each.
      expect(el.querySelectorAll(`[data-column="${key}"] app-training-cell`).length).toBe(4);
    }
    // corner + 순 + 순장 + rule + 3 rows.
    expect(el.querySelector('[data-testid="row-labels"]')!.children.length).toBe(7);
  });

  it('spans the 새가족순 heading over rows 1 and 2 in the full table', () => {
    const el: HTMLElement = render('all').nativeElement;
    const header = el.querySelector('[data-column="nf"] > div')!;
    expect(header.textContent!.trim()).toBe('새가족순');
    expect(header.className).toContain('h-[64px]');
    expect(el.querySelector('[data-division="NEHEMIA"]')!.textContent).toContain('느헤미야');
  });

  it('keeps the division heading outside the scrolling columns in single mode', () => {
    const el: HTMLElement = render('single', [DIVISIONS[0]]).nativeElement;
    const scroll = el.querySelector('[data-testid="column-scroll"]')!;
    expect(scroll.textContent).not.toContain('느헤미야');
    expect(scroll.previousElementSibling!.textContent!.trim()).toBe('느헤미야');
    expect(scroll.querySelectorAll('[data-column]').length).toBe(2);
  });

  it('emits only for an interactive cell', () => {
    const fixture = render('all');
    const emitted: TrainingTableCell[] = [];
    fixture.componentInstance.cellActivated.subscribe(c => emitted.push(c));
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('app-training-cell button');
    expect(buttons.length).toBe(1);
    (buttons[0] as HTMLButtonElement).click();
    expect(emitted.map(c => c.id)).toEqual(['d']);
  });

  it('marks a candidate with a dashed border and the chevron-up', () => {
    const el: HTMLElement = render('all').nativeElement;
    const candidate = el.querySelector('[data-member="d"] button')!;
    expect(candidate.className).toContain('border-dashed');
    expect(candidate.querySelector('.pi-chevron-up')).not.toBeNull();
  });

  it('pulses only a clickable candidate', () => {
    const el: HTMLElement = render('all').nativeElement;
    expect(el.querySelector('[data-member="d"] button')!.className).toContain('motion-safe:animate-candidate-pulse');
    for (const id of ['a', 'e']) {
      expect(el.querySelector(`[data-member="${id}"] span`)!.className).not.toContain('animate-candidate-pulse');
    }
  });
});
