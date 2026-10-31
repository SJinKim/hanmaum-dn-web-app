import { badgeTokens } from './variant-tokens';

describe('badgeTokens — urgency (#277)', () => {
  const cases = [
    ['urgency-3', 'amber'],
    ['urgency-6', 'orange'],
    ['urgency-12', 'red'],
  ] as const;

  for (const [variant, colour] of cases) {
    it(`maps ${variant} to the ${colour} urgency pair`, () => {
      expect(badgeTokens(variant)).toEqual({
        background: `var(--color-badge-urgency-${colour}-bg)`,
        color: `var(--color-badge-urgency-${colour}-fg)`,
      });
    });

    it(`resolves the ${colour} pair in light and dark`, () => {
      for (const theme of ['light', 'dark']) {
        const el = document.createElement('div');
        el.setAttribute('data-theme', theme);
        document.body.appendChild(el);
        const style = getComputedStyle(el);
        expect(style.getPropertyValue(`--color-badge-urgency-${colour}-bg`).trim()).not.toBe('');
        expect(style.getPropertyValue(`--color-badge-urgency-${colour}-fg`).trim()).not.toBe('');
        el.remove();
      }
    });
  }

  it('keeps unknown names on the neutral pair', () => {
    expect(badgeTokens('urgency-24').background).toBe('var(--color-badge-neutral-bg)');
  });
});
