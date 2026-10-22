import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { memberPillTokens, MemberPillStage } from '../variant-tokens';

/** Figma: TrainingTable/MemberCell State axis (1347:581). */
export type TrainingCellState = 'default' | 'dimmed' | 'candidate';

/**
 * Figma: Data / TrainingTable/MemberCell (1347:581) — one 청년 in the 양육 table.
 *
 * The cell draws its own right and bottom grid line; the chip inside takes the
 * same `color/category/*` pair as MemberPill, so a stage reads the same in the
 * table and in the 청년 list. Stage `none` has no fill — an uncoloured cell, as
 * in the paper 양육 list.
 *
 * Dimmed = filtered out but still shown: neutral grey, so a filter never hides a
 * member. Candidate = a 제자반수료 who can be promoted to 예비순장: dashed border
 * and a chevron-up, never colour alone; while clickable it also pulses (motion-safe
 * only), so the promotable cells stand out. `stageLabel` is the tooltip and the
 * screen-reader text for the stage.
 *
 * An interactive cell renders a button and emits `activated`; `actionLabel` is
 * its accessible name. An empty `label` renders a blank grid cell.
 */
@Component({
  selector: 'app-training-cell',
  standalone: true,
  template: `
    <div class="flex h-[24px] border-b border-r border-line-subtle bg-surface p-[var(--space-2)] tablet:h-[28px]">
      @if (label()) {
        @if (interactive()) {
          <button
            type="button"
            [class]="chipClass()"
            [style.background]="background()"
            [style.color]="color()"
            [style.border-color]="borderColor()"
            [attr.title]="stageLabel()"
            [attr.aria-label]="actionLabel() || null"
            (click)="activated.emit()">
            <ng-container *ngTemplateOutlet="content" />
          </button>
        } @else {
          <span
            [class]="chipClass()"
            [style.background]="background()"
            [style.color]="color()"
            [style.border-color]="borderColor()"
            [attr.title]="stageLabel()">
            <ng-container *ngTemplateOutlet="content" />
          </span>
        }
      }
    </div>

    <ng-template #content>
      <span class="truncate" [class.opacity-[0.55]]="state() === 'dimmed'">{{ label() }}</span>
      <span class="sr-only">{{ stageLabel() }}</span>
      @if (state() === 'candidate') {
        <i class="pi pi-chevron-up shrink-0 text-[10px] font-bold" aria-hidden="true"></i>
      }
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
})
export class TrainingCellComponent {
  /** The member's name; empty renders a blank cell. */
  readonly label = input('');
  readonly stage = input<MemberPillStage>('none');
  /** Human-readable stage name; the non-colour signal for the stage. */
  readonly stageLabel = input('');
  readonly state = input<TrainingCellState>('default');
  readonly interactive = input(false);
  /** Accessible name of the button when `interactive`. */
  readonly actionLabel = input('');

  readonly activated = output<void>();

  private readonly tokens = computed(() => memberPillTokens(this.stage()));

  protected readonly background = computed(() => {
    if (this.state() === 'dimmed') return 'var(--color-bg-subtle)';
    return this.stage() === 'none' ? 'transparent' : this.tokens().background;
  });

  protected readonly color = computed(() =>
    this.state() === 'dimmed' ? 'var(--color-text-muted)' : this.tokens().color,
  );

  protected readonly borderColor = computed(() =>
    this.state() === 'candidate' ? this.tokens().color : 'transparent',
  );

  protected chipClass(): string {
    const base =
      'type-body-sm flex min-w-0 flex-1 items-center justify-center gap-[var(--space-2)] whitespace-nowrap ' +
      'rounded-[var(--radius-sm)] border px-[var(--space-4)]';
    const border = this.state() === 'candidate' ? ' border-dashed' : ' border-solid';
    const action = this.interactive()
      ? ' cursor-pointer focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:1px]'
      : '';
    const pulse = this.interactive() && this.state() === 'candidate' ? ' motion-safe:animate-candidate-pulse' : '';
    return base + border + action + pulse;
  }
}
