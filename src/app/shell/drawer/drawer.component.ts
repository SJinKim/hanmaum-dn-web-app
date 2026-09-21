import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, take } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';

/**
 * Figma: Drawer (157:1738) — the phone navigation, see screen 248:15804.
 *
 * Renders only while open, so the scrim and the focus trap exist exactly as long
 * as the overlay does. Closing is driven from three places the issue names —
 * scrim click, Escape, route change — and all three go through the `dismiss`
 * output; the shell owns the open state.
 */
@Component({
  selector: 'app-drawer',
  standalone: true,
  imports: [SidebarComponent, TranslatePipe],
  templateUrl: './drawer.component.html',
  host: { class: 'contents' },
})
export class DrawerComponent implements AfterViewInit {
  private readonly router = inject(Router);

  readonly dismiss = output<void>();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  /** Focusable children of the panel, in document order. */
  private readonly focusable = computed(() =>
    Array.from(
      this.panel().nativeElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ),
  );

  constructor() {
    // A route change while the drawer is open closes it — the navigation the tap
    // triggered is the point, the overlay is not.
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        take(1),
      )
      .subscribe(() => this.dismiss.emit());
  }

  ngAfterViewInit(): void {
    this.focusable()[0]?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismiss.emit();
  }

  @HostListener('document:keydown.tab', ['$event'])
  @HostListener('document:keydown.shift.tab', ['$event'])
  trapFocus(event: Event): void {
    // `@HostListener` types `$event` as `Event`; the key binding guarantees a keydown.
    const keyEvent = event as KeyboardEvent;
    const items = this.focusable();
    if (items.length === 0) {
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (!this.panel().nativeElement.contains(active)) {
      keyEvent.preventDefault();
      (keyEvent.shiftKey ? last : first).focus();
      return;
    }
    if (keyEvent.shiftKey && active === first) {
      keyEvent.preventDefault();
      last.focus();
    } else if (!keyEvent.shiftKey && active === last) {
      keyEvent.preventDefault();
      first.focus();
    }
  }
}
