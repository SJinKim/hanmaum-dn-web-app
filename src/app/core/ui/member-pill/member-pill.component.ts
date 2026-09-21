import { Component, computed, input } from '@angular/core';
import { memberPillTokens, MemberPillStage } from '../variant-tokens';

/** Figma: MemberPill State axis (213:574). */
export type MemberPillState = 'default' | 'dimmed' | 'candidate';

/**
 * Figma: Data / MemberPill (213:574) — 17 symbols across Stage × State.
 *
 * One component, one `stage` input; the stage → token mapping lives in
 * `variant-tokens.ts` and nowhere else. The dot is drawn in CSS, not exported
 * from Figma, and takes `color/category/*-dot` — the one colour declared once
 * for every theme so a member stays recognisable across a theme switch.
 *
 * Figma: "Colour is never the only signal — the stage name is exposed as a
 * tooltip/aria-label and in the legend." Hence `stageLabel`, required: it is the
 * tooltip for sighted users and screen-reader text for everyone else.
 *
 * Dimmed = filtered out but still shown, so a filter never hides information.
 * Candidate = a 순장 candidate, marked by a dashed border and `candidateLabel`
 * rather than by colour alone.
 */
@Component({
  selector: 'app-member-pill',
  standalone: true,
  template: `
    <span
      class="type-body-sm inline-flex w-fit items-center gap-[var(--space-6)] whitespace-nowrap rounded-[var(--radius-full)] border px-[var(--space-10)] py-[var(--space-4)]"
      [style.background]="tokens().background"
      [style.color]="tokens().color"
      [style.border-style]="state() === 'candidate' ? 'dashed' : 'solid'"
      [style.border-color]="state() === 'candidate' ? tokens().color : 'transparent'"
      [style.opacity]="state() === 'dimmed' ? 0.35 : null"
      [attr.title]="stageLabel()">
      <span class="size-[8px] shrink-0 rounded-[var(--radius-full)]" [style.background]="tokens().dot"></span>
      <span>{{ label() }}</span>
      <span class="sr-only">{{ stageLabel() }}</span>
      @if (state() === 'candidate') {
        <span class="type-caption">{{ candidateLabel() }}</span>
      }
    </span>
  `,
})
export class MemberPillComponent {
  /** The member's name — what the pill shows. */
  readonly label = input.required<string>();
  readonly stage = input<MemberPillStage>('none');
  /** Human-readable stage name; the non-colour signal for the stage. */
  readonly stageLabel = input.required<string>();
  readonly state = input<MemberPillState>('default');
  readonly candidateLabel = input('+ 지정');

  protected readonly tokens = computed(() => memberPillTokens(this.stage()));
}
