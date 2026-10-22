import { computed, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Breakpoint, BreakpointService } from '../core/ui/breakpoint.service';
import { ShellComponent } from './shell.component';

/** Real browser layout with the production Tailwind stylesheet, not class-name assertions. */
describe('Shell scroll containment (#263)', () => {
  let frame: HTMLIFrameElement;
  let fixture: ComponentFixture<ShellComponent>;

  afterEach(() => {
    fixture?.destroy();
    frame?.remove();
  });

  async function render(width: number, height: number, breakpoint: Breakpoint): Promise<Document> {
    const current = signal(breakpoint);
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        {
          provide: BreakpointService,
          useValue: {
            isPhone: computed(() => current() === 'phone'),
            isTablet: computed(() => current() === 'tablet'),
            isDesktop: computed(() => current() === 'desktop'),
          },
        },
      ],
    });

    frame = document.createElement('iframe');
    frame.style.cssText = `position:fixed;left:-10000px;width:${width}px;height:${height}px;border:0`;
    document.body.append(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write('<!doctype html><html><head></head><body></body></html>');
    doc.close();

    // Karma loads the app's global stylesheet; give each iframe the same CSS.
    await Promise.all(Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(node => {
      const clone = node.cloneNode(true) as HTMLElement;
      if (clone instanceof HTMLLinkElement) {
        clone.href = (node as HTMLLinkElement).href;
        return new Promise<void>((resolve, reject) => {
          clone.onload = () => resolve();
          clone.onerror = () => reject(new Error(`Stylesheet failed: ${clone.href}`));
          doc.head.append(clone);
        });
      }
      doc.head.append(clone);
      return Promise.resolve();
    }));

    fixture = TestBed.createComponent(ShellComponent);
    doc.body.append(fixture.nativeElement);
    fixture.detectChanges();
    return doc;
  }

  for (const viewport of [
    { width: 1440, height: 900, breakpoint: 'desktop' as const },
    { width: 834, height: 600, breakpoint: 'tablet' as const },
    { width: 390, height: 600, breakpoint: 'phone' as const },
  ]) {
    it(`keeps long, wide and collapsed content inside main on ${viewport.breakpoint}`, async () => {
      const { width, height, breakpoint } = viewport;
      const doc = await render(width, height, breakpoint);
      const main = doc.querySelector('main')!;
      const sidebar = doc.querySelector('app-sidebar');
      const header = doc.querySelector('app-header')!;
      const headerTop = header.getBoundingClientRect().top;
      const sidebarTop = sidebar?.getBoundingClientRect().top;

      // Home's collapsed accordion still renders its absolutely positioned caption.
      // A distant static caption escaped overflow-hidden before main was positioned.
      main.insertAdjacentHTML('beforeend', `
        <div style="height:${height * 3}px;width:${width * 2}px"></div>
        <div style="display:grid;grid-template-rows:0fr">
          <div style="overflow:hidden;min-height:0">
            <table><caption class="sr-only">Collapsed attendance</caption>
              <tbody><tr><td style="height:500px">Collapsed rows</td></tr></tbody>
            </table>
          </div>
        </div>
        <table><caption class="sr-only">Visible attendance</caption>
          <tbody><tr><td>Last reachable row</td></tr></tbody>
        </table>
      `);

      expect(main.clientHeight).toBeGreaterThan(0);
      expect(main.scrollHeight).toBeGreaterThan(height * 2);
      expect(main.scrollWidth).toBeGreaterThan(width);
      expect(doc.documentElement.scrollHeight).withContext('outer vertical overflow').toBe(height);
      expect(doc.documentElement.scrollWidth).withContext('outer horizontal overflow').toBeLessThanOrEqual(width);

      frame.contentWindow!.scrollTo(width * 3, height * 5);
      expect(frame.contentWindow!.scrollY).toBe(0);
      expect(frame.contentWindow!.scrollX).toBe(0);

      main.scrollTop = main.scrollHeight;
      main.scrollLeft = main.scrollWidth;
      expect(main.scrollTop).toBeGreaterThan(0);
      expect(main.scrollLeft).toBeGreaterThan(0);
      expect(main.lastElementChild!.getBoundingClientRect().bottom)
        .toBeLessThanOrEqual(main.getBoundingClientRect().bottom);
      expect(header.getBoundingClientRect().top).toBe(headerTop);
      expect(sidebar?.getBoundingClientRect().top).toBe(sidebarTop);

      if (breakpoint === 'phone') {
        fixture.componentInstance.openDrawer();
        fixture.detectChanges();
        const dialog = doc.querySelector('[role="dialog"]')!;
        expect(dialog.getBoundingClientRect().top).toBe(0);
        expect(dialog.getBoundingClientRect().bottom).toBe(height);
        expect(doc.documentElement.scrollHeight).toBe(height);
      }
    });
  }
});
