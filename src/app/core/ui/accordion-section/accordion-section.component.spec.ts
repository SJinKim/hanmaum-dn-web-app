import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AccordionSectionComponent } from './accordion-section.component';

@Component({
  standalone: true,
  imports: [AccordionSectionComponent],
  template: `
    <app-accordion-section heading="이번 주 일요일" [count]="3" [(expanded)]="expanded">
      <p class="body">본문</p>
    </app-accordion-section>
  `,
})
class HostComponent {
  readonly expanded = signal(true);
}

describe('AccordionSectionComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const header = () => fixture.nativeElement.querySelector('[aria-expanded]') as HTMLElement;
    return { fixture, header };
  }

  it('renders the heading and count in a header that reports it is expanded', () => {
    const { fixture, header } = setup();
    expect(header().textContent).toContain('이번 주 일요일');
    expect(header().textContent).toContain('3');
    expect(header().getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('본문');
  });

  it('collapses on click and writes the state back through the model', () => {
    const { fixture, header } = setup();
    header().click();
    fixture.detectChanges();
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.expanded()).toBeFalse();
  });

  it('follows the bound state when the host changes it', () => {
    const { fixture, header } = setup();
    fixture.componentInstance.expanded.set(false);
    fixture.detectChanges();
    expect(header().getAttribute('aria-expanded')).toBe('false');
  });
});
