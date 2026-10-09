import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BulletinSharingBlock } from '../bulletins.model';
import { numberedSharing } from './bulletin-sharing.model';

/** Text interpolation preserves line breaks without interpreting editorial content as HTML. */
@Component({
  selector: 'app-bulletin-sharing-preview',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (blocks().length) {
      <section class="bg-surface flex flex-col gap-[var(--space-8)] rounded-[var(--radius-md)] p-[var(--space-12)]" data-testid="sharing-preview">
        <h3 class="type-overline text-ink-muted">{{ 'bulletins.editor.tabs.sharing' | translate }}</h3>
        @for (row of rows(); track $index) {
          @switch (row.block.type) {
            @case ('HEADING') {
              <h4 class="type-h3 text-ink-strong whitespace-pre-wrap [overflow-wrap:anywhere]">{{ row.block.text }}</h4>
            }
            @case ('PARAGRAPH') {
              <p class="type-body-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{{ row.block.text }}</p>
            }
            @case ('SCRIPTURE') {
              <blockquote class="bg-surface-subtle border-action flex flex-col gap-[var(--space-4)] border-l-[3px] px-[var(--space-12)] py-[var(--space-8)]">
                <p class="type-body-sm text-ink-strong whitespace-pre-wrap [overflow-wrap:anywhere]">{{ row.block.text }}</p>
                @if (row.block.reference?.trim()) {
                  <p class="type-caption text-ink-muted [overflow-wrap:anywhere]">{{ row.block.reference }}</p>
                }
              </blockquote>
            }
            @case ('QUESTION') {
              <div class="type-body-sm flex items-start gap-[var(--space-8)]" data-testid="sharing-preview-question">
                <span class="text-action shrink-0">{{ 'bulletins.sharing.questionNumber' | translate: { n: row.question } }}</span>
                <p class="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{{ row.block.text }}</p>
              </div>
            }
          }
        }
      </section>
    } @else {
      <section class="bg-surface border-line flex flex-col gap-[var(--space-8)] rounded-[var(--radius-md)] border border-dashed p-[var(--space-12)]" data-testid="sharing-preview-hidden">
        <h3 class="type-overline text-ink-muted">{{ 'bulletins.sharing.previewHidden' | translate }}</h3>
        <p class="type-body-sm text-ink-muted">{{ 'bulletins.sharing.previewHiddenHint' | translate }}</p>
      </section>
    }
  `,
})
export class BulletinSharingPreviewComponent {
  readonly blocks = input.required<readonly BulletinSharingBlock[]>();
  readonly rows = computed(() => numberedSharing(this.blocks()));
}
