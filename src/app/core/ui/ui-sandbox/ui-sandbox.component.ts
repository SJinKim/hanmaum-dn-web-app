import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

import { CommandPaletteComponent, type CommandPaletteGroup } from '../command-palette/command-palette.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { FilterChipComponent } from '../filter-chip/filter-chip.component';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { SearchFieldComponent } from '../search-field/search-field.component';
import { SectionHeaderComponent } from '../section-header/section-header.component';
import { SegmentedControlComponent, type SegmentOption } from '../segmented-control/segmented-control.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';

/**
 * Living reference for the Controls and Containers layer (issue #49).
 *
 * Every component in every Figma variant, rendered in Light and Dark side by
 * side. Appearance comes from the DnPreset in core/ui/dn-theme.preset.ts — this
 * screen contains no colour of its own, so anything off here is a token or a
 * preset bug, not a screen bug. Route: /design-ui.
 *
 * Dialog and Toast are overlays: PrimeNG teleports them to the document body, so
 * they follow the app-level theme instead of the two wrappers below. They are
 * demoed once, at the bottom.
 */
@Component({
  selector: 'app-ui-sandbox',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule, CardModule, CheckboxModule, DialogModule, InputTextModule, MenuModule,
    RadioButtonModule, SelectModule, TabsModule, TextareaModule, ToastModule,
    ToggleSwitchModule, TooltipModule,
    CommandPaletteComponent, EmptyStateComponent, FilterChipComponent, PageHeaderComponent,
    SearchFieldComponent, SectionHeaderComponent, SegmentedControlComponent, ToolbarComponent,
  ],
  providers: [MessageService],
  template: `
    <div>
      <app-page-header
        eyebrow="Issue #49"
        heading="UI Kit"
        subtitle="Controls & Containers · Figma &quot;DN-Web&quot; · see design-specs/DESIGN.md"
        [breadcrumb]="['디자인', 'UI Kit']"
        hasBack>
        <div appActions class="flex items-center gap-[var(--space-8)]">
          <p-button [text]="true" severity="secondary" label="Tokens" icon="pi pi-palette" />
          <p-button label="저장" icon="pi pi-check" />
        </div>
      </app-page-header>

      @for (mode of modes; track mode) {
        <section
          class="mb-gutter rounded-[var(--radius-lg)] border border-line bg-surface-base p-card"
          [attr.data-theme]="mode">
          <h2 class="type-overline text-ink-muted mb-4">{{ mode }}</h2>

          <!-- ── Controls ──────────────────────────────────────────────── -->
          <h3 class="type-h3 text-ink-strong mb-2">Button</h3>
          <div class="mb-6 flex flex-wrap items-center gap-[var(--space-8)]">
            <p-button label="추가" />
            <p-button label="추가" icon="pi pi-plus" />
            <p-button label="저장" severity="secondary" />
            <p-button label="삭제" severity="danger" />
            <p-button label="취소" severity="secondary" [outlined]="true" />
            <p-button label="삭제" severity="danger" [outlined]="true" />
            <p-button label="더보기" severity="secondary" [text]="true" />
            <p-button label="삭제" severity="danger" [text]="true" />
            <p-button label="비활성" [disabled]="true" />
            <p-button label="작게" size="small" />
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">IconButton</h3>
          <div class="mb-6 flex flex-wrap items-center gap-[var(--space-8)]">
            <p-button icon="pi pi-pencil" ariaLabel="수정" pTooltip="수정" />
            <p-button icon="pi pi-pencil" ariaLabel="수정" severity="secondary" [text]="true" />
            <p-button icon="pi pi-trash" ariaLabel="삭제" severity="danger" [text]="true" />
            <p-button icon="pi pi-ellipsis-h" ariaLabel="더보기" severity="secondary" [outlined]="true" />
            <p-button icon="pi pi-plus" ariaLabel="추가" size="small" />
            <p-button icon="pi pi-plus" ariaLabel="추가" [disabled]="true" />
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">Fields</h3>
          <div class="mb-6 grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3">
            <div class="flex flex-col gap-[var(--space-4)]">
              <label class="type-caption text-ink" [for]="'name-' + mode">이름</label>
              <input pInputText [id]="'name-' + mode" [(ngModel)]="text" placeholder="김민수" />
              <p class="type-caption text-ink-muted">도움말 텍스트</p>
            </div>
            <div class="flex flex-col gap-[var(--space-4)]">
              <label class="type-caption text-ink" [for]="'name-invalid-' + mode">이름 (오류)</label>
              <input pInputText [id]="'name-invalid-' + mode" [invalid]="true" value="" placeholder="김민수" />
              <p class="type-caption text-[color:var(--color-badge-deleted-fg)]">필수 항목입니다</p>
            </div>
            <div class="flex flex-col gap-[var(--space-4)]">
              <label class="type-caption text-ink-disabled" [for]="'name-disabled-' + mode">이름 (비활성)</label>
              <input pInputText [id]="'name-disabled-' + mode" [disabled]="true" value="김민수" />
            </div>
            <div class="flex flex-col gap-[var(--space-4)]">
              <label class="type-caption text-ink" [for]="'group-' + mode">소속</label>
              <p-select
                [inputId]="'group-' + mode"
                [options]="groups"
                optionLabel="label"
                optionValue="value"
                placeholder="선택하세요"
                [(ngModel)]="group" />
            </div>
            <div class="flex flex-col gap-[var(--space-4)]">
              <label class="type-caption text-ink" [for]="'note-' + mode">메모</label>
              <textarea pTextarea [id]="'note-' + mode" rows="3" [(ngModel)]="note" placeholder="내용을 입력하세요"></textarea>
            </div>
            <div class="flex flex-col gap-gutter">
              <app-search-field label="검색" hint="도움말 텍스트" [(value)]="search" />
              <app-search-field label="검색 (오류)" hint="검색어가 너무 짧습니다" invalid value="김" />
              <app-search-field label="검색 (비활성)" disabled />
            </div>
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">Selection</h3>
          <div class="mb-6 flex flex-wrap items-start gap-gutter">
            <div class="flex flex-col gap-[var(--space-8)]">
              <div class="flex items-center gap-[var(--space-8)]">
                <p-checkbox [binary]="true" [(ngModel)]="agreed" [inputId]="'agree-' + mode" />
                <label class="type-body-sm text-ink" [for]="'agree-' + mode">동의합니다</label>
              </div>
              <div class="flex items-center gap-[var(--space-8)]">
                <p-checkbox [binary]="true" [disabled]="true" [inputId]="'agree-off-' + mode" />
                <label class="type-body-sm text-ink-disabled" [for]="'agree-off-' + mode">비활성</label>
              </div>
            </div>
            <div class="flex flex-col gap-[var(--space-8)]">
              @for (option of groups; track option.value) {
                <div class="flex items-center gap-[var(--space-8)]">
                  <p-radiobutton
                    [name]="'group-radio-' + mode"
                    [value]="option.value"
                    [(ngModel)]="group"
                    [inputId]="'radio-' + option.value + '-' + mode" />
                  <label class="type-body-sm text-ink" [for]="'radio-' + option.value + '-' + mode">
                    {{ option.label }}
                  </label>
                </div>
              }
            </div>
            <div class="flex flex-col gap-[var(--space-8)]">
              <div class="flex items-center gap-[var(--space-8)]">
                <p-toggleswitch [(ngModel)]="notify" [inputId]="'notify-' + mode" />
                <label class="type-body-sm text-ink" [for]="'notify-' + mode">알림 받기</label>
              </div>
              <div class="flex items-center gap-[var(--space-8)]">
                <p-toggleswitch [disabled]="true" [inputId]="'notify-off-' + mode" />
                <label class="type-body-sm text-ink-disabled" [for]="'notify-off-' + mode">비활성</label>
              </div>
            </div>
            <app-segmented-control
              class="w-[360px]"
              ariaLabel="기간"
              [options]="periods"
              [(value)]="period" />
          </div>

          <!-- ── Containers ────────────────────────────────────────────── -->
          <h3 class="type-h3 text-ink-strong mb-2">Card & SectionHeader</h3>
          <div class="mb-6 flex flex-col gap-[var(--space-8)]">
            <app-section-header heading="청년 목록" actionLabel="전체 보기" actionIcon="pi pi-arrow-right" />
            <p-card>
              <p class="type-body text-ink-muted">
                Card sitzt auf bg/surface, 1px border/subtle, radius-lg, Elevation/sm.
              </p>
            </p-card>
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">Toolbar & FilterChip</h3>
          <app-toolbar class="mb-6 block" hasFilters>
            <app-search-field appSearch [(value)]="search" />
            <p-button appActions label="추가" icon="pi pi-plus" />
            <ng-container appFilters>
              @for (filter of filters; track filter) {
                <app-filter-chip
                  [label]="filter"
                  [count]="filter === '활성' ? 128 : undefined"
                  [selected]="activeFilter() === filter"
                  (toggled)="activeFilter.set(activeFilter() === filter ? '' : filter)" />
              }
              <app-filter-chip label="제거 가능" removable selected />
            </ng-container>
          </app-toolbar>

          <h3 class="type-h3 text-ink-strong mb-2">Tabs</h3>
          <p-tabs class="mb-6 block" [value]="0">
            <p-tablist>
              <p-tab [value]="0">청년</p-tab>
              <p-tab [value]="1">사역</p-tab>
              <p-tab [value]="2">출석</p-tab>
              <p-tab [value]="3" [disabled]="true">비활성</p-tab>
            </p-tablist>
            <p-tabpanels>
              <p-tabpanel [value]="0"><p class="type-body text-ink-muted">청년 내용</p></p-tabpanel>
              <p-tabpanel [value]="1"><p class="type-body text-ink-muted">사역 내용</p></p-tabpanel>
              <p-tabpanel [value]="2"><p class="type-body text-ink-muted">출석 내용</p></p-tabpanel>
              <p-tabpanel [value]="3"><p class="type-body text-ink-muted">—</p></p-tabpanel>
            </p-tabpanels>
          </p-tabs>

          <h3 class="type-h3 text-ink-strong mb-2">MenuItem & OverflowMenu</h3>
          <div class="mb-6 flex flex-wrap items-start gap-gutter">
            <p-menu [model]="menuItems" />
            <p-button
              icon="pi pi-ellipsis-v"
              ariaLabel="더보기"
              severity="secondary"
              [text]="true"
              (onClick)="overflow.toggle($event)" />
            <p-menu #overflow [model]="menuItems" [popup]="true" />
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">EmptyState</h3>
          <div class="mb-6 grid grid-cols-1 gap-gutter lg:grid-cols-3">
            <app-empty-state
              variant="no-data"
              heading="아직 항목이 없습니다"
              description="새 항목을 추가하면 여기에 표시됩니다." />
            <app-empty-state
              variant="no-results"
              heading="검색 결과가 없습니다"
              description="다른 검색어로 다시 시도해 보세요." />
            <app-empty-state
              variant="error"
              heading="불러오지 못했습니다"
              description="잠시 후 다시 시도해 주세요."
              actionLabel="다시 시도"
              actionIcon="pi pi-refresh" />
          </div>

          <h3 class="type-h3 text-ink-strong mb-2">CommandPalette</h3>
          <div class="flex flex-wrap items-start gap-gutter">
            <app-command-palette [groups]="paletteRecent" hint="⌘K 로 열기" />
            <app-command-palette [groups]="paletteResults" [query]="'김민수'" />
          </div>
        </section>
      }

      <!-- Overlays: body-teleported, so they follow the app theme. -->
      <section class="rounded-[var(--radius-lg)] border border-line bg-surface p-card">
        <h3 class="type-h3 text-ink-strong mb-2">Dialog & Toast</h3>
        <p class="type-caption text-ink-muted mb-3">
          Overlays hängen am document.body — sie folgen dem App-Theme, nicht den beiden Blöcken oben.
        </p>
        <div class="flex flex-wrap items-center gap-[var(--space-8)]">
          <p-button label="Dialog öffnen" severity="secondary" [outlined]="true" (onClick)="dialogVisible = true" />
          @for (severity of toastSeverities; track severity) {
            <p-button
              [label]="severity"
              size="small"
              severity="secondary"
              [text]="true"
              (onClick)="showToast(severity)" />
          }
        </div>
      </section>

      <p-dialog
        header="청년 삭제"
        [modal]="true"
        [style]="{ width: '420px' }"
        [(visible)]="dialogVisible">
        <p class="type-body text-ink">김민수 청년을 삭제하시겠습니까?</p>
        <p class="type-caption text-ink-muted mt-2">삭제된 항목은 목록에서 숨겨집니다.</p>
        <ng-template #footer>
          <p-button label="취소" severity="secondary" [text]="true" (onClick)="dialogVisible = false" />
          <p-button label="삭제" severity="danger" (onClick)="dialogVisible = false" />
        </ng-template>
      </p-dialog>

      <p-toast />
    </div>
  `,
})
export class UiSandboxComponent {
  readonly modes = ['light', 'dark'] as const;

  /** Mutable on purpose: p-select and p-menu take mutable arrays. */
  readonly groups: SegmentOption[] = [
    { value: 'youth', label: '청년부' },
    { value: 'college', label: '대학부' },
    { value: 'newcomer', label: '새가족' },
  ];

  readonly periods: readonly SegmentOption[] = [
    { value: 'week', label: '주간' },
    { value: 'month', label: '월간' },
    { value: 'year', label: '연간' },
  ];

  readonly filters = ['활성', '관리자', '양육', '사역'] as const;

  readonly toastSeverities = ['success', 'info', 'warn', 'error'] as const;

  readonly menuItems: MenuItem[] = [
    { label: '수정', icon: 'pi pi-pencil' },
    { label: '복제', icon: 'pi pi-copy' },
    { separator: true },
    { label: '삭제', icon: 'pi pi-trash', styleClass: 'text-[color:var(--color-badge-deleted-fg)]' },
  ];

  readonly paletteRecent: readonly CommandPaletteGroup[] = [
    {
      label: '최근 이동',
      items: [
        { id: 'members', label: '청년 목록' },
        { id: 'events', label: '이벤트 목록' },
        { id: 'announce', label: '공지 작성' },
      ],
    },
  ];

  readonly paletteResults: readonly CommandPaletteGroup[] = [
    {
      label: '이동',
      items: [
        { id: 'detail', label: '청년 상세로 이동' },
        { id: 'edit', label: '청년 수정' },
      ],
    },
    {
      label: '청년',
      items: [
        { id: 'minsu', label: '김민수' },
        { id: 'minjun', label: '김민준' },
      ],
    },
  ];

  protected text = '';
  protected note = '';
  protected search = '';
  protected group = 'youth';
  protected period = 'week';
  protected agreed = true;
  protected notify = true;

  protected dialogVisible = false;

  protected readonly activeFilter = signal<string>('활성');

  private readonly messages = inject(MessageService);

  protected showToast(severity: string): void {
    this.messages.add({
      severity,
      summary: severity,
      detail: '저장되었습니다.',
    });
  }
}
