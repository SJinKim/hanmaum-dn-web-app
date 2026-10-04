import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { catchError, forkJoin, map, of } from 'rxjs';

import { AvatarComponent } from '../../../core/ui/avatar/avatar.component';
import { BadgeComponent } from '../../../core/ui/badge/badge.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../../core/ui/search-field/search-field.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { MinistryService } from '../ministry.service';
import { ActiveMinistryMemberDto, MinistrySummary } from '../ministry.model';

/** Figma shows at most four avatars per card, the rest as `+N`. */
const PREVIEW_SIZE = 4;

interface MinistryCard {
  ministry: MinistrySummary;
  /** Null while the members are loading or when their request failed. */
  members: ActiveMinistryMemberDto[] | null;
}

@Component({
  selector: 'app-ministry-list',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    ButtonModule,
    AvatarComponent,
    BadgeComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    SearchFieldComponent,
    SkeletonComponent,
  ],
  templateUrl: './ministry-list.component.html',
})
export class MinistryListComponent implements OnInit {
  private readonly ministryService = inject(MinistryService);
  private readonly router          = inject(Router);
  private readonly destroyRef      = inject(DestroyRef);

  readonly ministries = signal<MinistrySummary[]>([]);
  /** Active members per ministry publicId. */
  readonly members    = signal<ReadonlyMap<string, ActiveMinistryMemberDto[]>>(new Map());
  readonly loading    = signal(true);
  readonly failed     = signal(false);
  readonly searchText = signal('');

  readonly total       = computed(() => this.ministries().length);
  readonly activeCount = computed(() => this.ministries().filter(m => m.isActive).length);

  readonly cards = computed<MinistryCard[]>(() => {
    const query   = this.searchText().trim().toLowerCase();
    const members = this.members();
    return this.ministries()
      .filter(m => !query || m.title.toLowerCase().includes(query))
      .map(ministry => ({ ministry, members: members.get(ministry.publicId) ?? null }));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.ministryService.getMinistries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.ministries.set(list);
        this.loading.set(false);
        this.loadMembers(list);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  goToCreate(): void { this.router.navigate(['/ministry', 'new']); }

  preview(members: ActiveMinistryMemberDto[]): ActiveMinistryMemberDto[] {
    return members.slice(0, PREVIEW_SIZE);
  }

  overflow(members: ActiveMinistryMemberDto[]): number {
    return Math.max(0, members.length - PREVIEW_SIZE);
  }

  /**
   * One request per card until the summary carries `memberCount` and a preview
   * (hanmaum-dn-server#214). A failed card keeps `null` and hides its member row
   * instead of failing the whole list.
   */
  private loadMembers(list: MinistrySummary[]): void {
    if (list.length === 0) {
      return;
    }
    forkJoin(
      list.map(m =>
        this.ministryService.getActiveMembers(m.publicId).pipe(
          map(members => [m.publicId, members] as const),
          catchError(() => of(null)),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(entries => {
        const byId = new Map<string, ActiveMinistryMemberDto[]>();
        for (const entry of entries) {
          if (entry) {
            byId.set(entry[0], entry[1]);
          }
        }
        this.members.set(byId);
      });
  }
}
