import { Directive, HostListener } from '@angular/core';

/** Keep the text control nullable; browsers' number inputs accept exponent tokens. */
@Directive({ selector: 'input[appGuideCount]', standalone: true })
export class GuideCountInputDirective {
  @HostListener('beforeinput', ['$event'])
  beforeInput(event: InputEvent): void {
    if (event.data && !/^\d+$/.test(event.data)) event.preventDefault();
  }
  @HostListener('paste', ['$event'])
  paste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text');
    if (text && !/^\d+$/.test(text)) event.preventDefault();
  }
}
