import { Component, computed, inject, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { NavGroup, NavItem } from '../../core/navigation/nav-config';
import { RoleService } from '../../core/services/role.service';

/**
 * Figma: Sidebar (157:1651) with NavItem (156:56) and NavGroupLabel (156:57).
 *
 * Mode maps to the density modes: Expanded on Desktop, Rail on Tablet (icons
 * only, labels hidden), Drawer inside the phone Drawer overlay (157:1738).
 * Figma realises each mode's width by switching the density mode so all three
 * read `size/sidebar`; CSS resolves `--size-sidebar` per viewport instead, and
 * the collapse toggle lets a mode render at a viewport whose token says
 * otherwise (Rail on Desktop). The widths below are therefore the density
 * values of `size/sidebar` itself (DESIGN.md:178) — not new design decisions.
 */
export type SidebarMode = 'expanded' | 'rail' | 'drawer';

const MODE_WIDTH: Record<SidebarMode, string> = {
  expanded: '256px',
  rail: '72px',
  drawer: 'var(--size-sidebar)',
};

/** `routerLinkActiveOptions` needs a stable object per item, not a new one per change detection. */
interface SidebarNavItem extends NavItem {
  readonly linkActiveOptions: { exact: boolean };
}

interface SidebarNavGroup {
  readonly labelKey: string;
  readonly items: readonly SidebarNavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, TooltipModule, TranslatePipe],
  templateUrl: './sidebar.component.html',
  host: { class: 'flex self-stretch' },
})
export class SidebarComponent {
  private readonly roles = inject(RoleService);

  readonly mode = input<SidebarMode>('expanded');

  /** Emitted by the header toggle; the shell owns and persists the preference. */
  readonly modeToggle = output<void>();

  /** Emitted on every nav click so the Drawer can close itself. */
  readonly navigate = output<void>();

  readonly isRail = computed(() => this.mode() === 'rail');
  readonly showLabels = computed(() => this.mode() !== 'rail');
  readonly showToggle = computed(() => this.mode() !== 'drawer');
  readonly width = computed(() => MODE_WIDTH[this.mode()]);

  readonly groups = computed<readonly SidebarNavGroup[]>(() =>
    this.roles.navGroups().map(group => this.toViewGroup(group)),
  );

  private toViewGroup(group: NavGroup): SidebarNavGroup {
    return {
      labelKey: group.labelKey,
      items: group.items.map(item => ({ ...item, linkActiveOptions: { exact: item.exact === true } })),
    };
  }
}
