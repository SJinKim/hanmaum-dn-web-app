/**
 * Figma: 04 · Components — Data (26:5).
 *
 * The one place a variant name becomes a colour token. Badge and MemberPill are
 * each a single component driven by a name input, and that name → token mapping
 * lives here so no feature re-declares it. An unknown name resolves to the
 * neutral variant instead of emitting an undefined custom property, which would
 * render as transparent-on-transparent.
 *
 * Figma: "Bind bg/fg per variant — never substitute a neighboring token pair."
 * Five pairs clear contrast with little headroom (4.51–4.58:1), so the pairs are
 * always taken together, never mixed across variants.
 */

/** Paired background/foreground custom properties for one variant. */
export interface VariantTokens {
  readonly background: string;
  readonly color: string;
}

/**
 * Badge variants. Ten come from Figma (95:42); `group-leader` is the web-only
 * extension documented in styles.scss — 순장 has no Figma token yet and reuses
 * the amber pair until one exists.
 *
 * The legacy `.badge-training-inactive` utility has no token pair of its own
 * (styles.scss aliases it to the deleted pair), so it is not a variant here —
 * callers use `deleted`.
 */
export const BADGE_VARIANTS = [
  'active',
  'inactive',
  'pending',
  'deleted',
  'admin',
  'member',
  'training-completed',
  'training-progress',
  'ministry-active',
  'group-leader',
  'neutral',
] as const;

export type BadgeVariant = (typeof BADGE_VARIANTS)[number];

/** Figma: MemberPill stage axis (213:574). `none` has no category token pair. */
export const MEMBER_PILL_STAGES = [
  'next-leader',
  'discipleship',
  'one-on-one-completed',
  'one-on-one-progress',
  'one-on-one-waiting',
  'qbs',
  'unbaptized',
  'none',
] as const;

export type MemberPillStage = (typeof MEMBER_PILL_STAGES)[number];

const BADGE_NAMES: ReadonlySet<string> = new Set(BADGE_VARIANTS);
const STAGE_NAMES: ReadonlySet<string> = new Set(MEMBER_PILL_STAGES);

/** Narrows an untyped value to a badge variant, falling back to `neutral`. */
export function resolveBadgeVariant(value: string | null | undefined): BadgeVariant {
  return value && BADGE_NAMES.has(value) ? (value as BadgeVariant) : 'neutral';
}

/** Narrows an untyped value to a pill stage, falling back to `none`. */
export function resolveMemberPillStage(value: string | null | undefined): MemberPillStage {
  return value && STAGE_NAMES.has(value) ? (value as MemberPillStage) : 'none';
}

export function badgeTokens(variant: string | null | undefined): VariantTokens {
  const name = resolveBadgeVariant(variant);
  return {
    background: `var(--color-badge-${name}-bg)`,
    color: `var(--color-badge-${name}-fg)`,
  };
}

/**
 * Stage `none` is the neutral fallback Figma specifies: subtle surface, default
 * text, and a dot in the strong border colour so an unset stage still reads as a
 * segment in the GroupCard distribution bar.
 */
export function memberPillTokens(stage: string | null | undefined): VariantTokens & { readonly dot: string } {
  const name = resolveMemberPillStage(stage);
  if (name === 'none') {
    return {
      background: 'var(--color-bg-subtle)',
      color: 'var(--color-text-default)',
      dot: 'var(--color-border-strong)',
    };
  }
  return {
    background: `var(--color-category-${name}-bg)`,
    color: `var(--color-category-${name}-fg)`,
    dot: `var(--color-category-${name}-dot)`,
  };
}
