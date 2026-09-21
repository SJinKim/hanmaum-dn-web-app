import { booleanAttribute, Component, computed, input } from '@angular/core';

/** Figma: Avatar Size axis (100:158) — 24 / 32 / 40 / 56. */
export type AvatarSize = 24 | 32 | 40 | 56;

const SIZE_TYPE: Record<AvatarSize, string> = {
  24: 'type-overline',
  32: 'type-caption',
  40: 'type-body-sm',
  56: 'type-h3',
};

/**
 * Figma: Data / Avatar (100:158).
 *
 * "Always uses the solid color/action/primary fill — no photo/image variant
 * yet." The glyph is the first character of the name, which for Korean names is
 * the family name and the only initial that reads.
 *
 * Set `decorative` where the name is already visible next to the avatar (table
 * AvatarName cell, ListCard) so screen readers do not hear it twice.
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <span
      class="bg-action text-action-on inline-flex shrink-0 items-center justify-center rounded-[var(--radius-full)]"
      [class]="typeClass()"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [attr.role]="decorative() ? null : 'img'"
      [attr.aria-label]="decorative() ? null : name()"
      [attr.aria-hidden]="decorative() ? 'true' : null">
      {{ glyph() }}
    </span>
  `,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly size = input<AvatarSize>(32);
  /** Overrides the derived glyph — use for latin initials like `SK`. */
  readonly initials = input<string>();
  readonly decorative = input(false, { transform: booleanAttribute });

  protected readonly glyph = computed(() => this.initials() ?? this.name().trim().charAt(0));
  protected readonly typeClass = computed(() => SIZE_TYPE[this.size()]);
}
