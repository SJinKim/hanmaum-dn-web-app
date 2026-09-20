/**
 * Guards the token layer in src/styles.scss — see design-specs/DESIGN.md.
 *
 * The token names are not hardcoded here: they are read back out of the CSSOM,
 * so the spec cannot drift from the stylesheet. What it asserts is the contract
 * the stylesheet has to keep:
 *   - Light and Dark declare exactly the same set of Theme tokens.
 *   - Every one of them resolves to a value in its own mode.
 *   - The elevations resolve per mode, i.e. a dark subtree really does get the
 *     dark shadow colour. A custom property containing var() is substituted
 *     where it is declared, so this only holds while §4 is declared on every
 *     theme root — that is the regression this case exists for.
 */

type RuleVisitor = (rule: CSSStyleRule) => void;

function walk(rules: CSSRuleList, visit: RuleVisitor): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSMediaRule) {
      walk(rule.cssRules, visit);
    } else if (rule instanceof CSSStyleRule) {
      visit(rule);
    }
  }
}

/** Custom property names declared by every rule whose selector matches. */
function declaredProps(selectorMatches: (selector: string) => boolean): Set<string> {
  const names = new Set<string>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet — not ours
    }
    walk(rules, rule => {
      if (!selectorMatches(rule.selectorText)) return;
      for (const prop of Array.from(rule.style)) {
        if (prop.startsWith('--')) names.add(prop);
      }
    });
  }
  return names;
}

describe('design tokens', () => {
  let dark: HTMLElement;

  const light = declaredProps(s => s.includes('[data-theme="light"]'));
  const darkDeclared = declaredProps(s => s.includes('[data-theme="dark"]'));

  const resolve = (el: Element, token: string): string =>
    getComputedStyle(el).getPropertyValue(token).trim();

  beforeEach(() => {
    dark = document.createElement('div');
    dark.setAttribute('data-theme', 'dark');
    document.body.appendChild(dark);
  });

  afterEach(() => dark.remove());

  it('declares the Theme layer at all', () => {
    expect(light.size).toBeGreaterThan(40);
  });

  it('declares the same tokens in Light and Dark', () => {
    const onlyLight = [...light].filter(t => !darkDeclared.has(t)).sort();
    const onlyDark = [...darkDeclared].filter(t => !light.has(t)).sort();
    expect(onlyLight).toEqual([]);
    expect(onlyDark).toEqual([]);
  });

  it('resolves every Theme token in Light', () => {
    const unresolved = [...light].filter(t => !resolve(document.documentElement, t)).sort();
    expect(unresolved).toEqual([]);
  });

  it('resolves every Theme token in Dark', () => {
    const unresolved = [...darkDeclared].filter(t => !resolve(dark, t)).sort();
    expect(unresolved).toEqual([]);
  });

  it('resolves the elevations per mode', () => {
    for (const size of ['sm', 'md', 'lg']) {
      const shadow = `--shadow-${size}`;
      expect(resolve(document.documentElement, shadow)).toBeTruthy();
      expect(resolve(dark, shadow)).toBeTruthy();
      // Same geometry, different shadow colour — so the strings must differ.
      expect(resolve(dark, shadow)).not.toEqual(resolve(document.documentElement, shadow));
    }
  });

  it('resolves the Density tokens', () => {
    const density = [
      '--size-sidebar', '--size-topbar', '--space-page', '--space-card', '--space-gutter',
      '--size-control-md', '--size-control-sm', '--size-icon-button', '--size-icon-button-sm',
      '--size-table-row', '--font-display', '--font-h1', '--font-h2',
      '--radius-sm', '--radius-md', '--radius-lg', '--radius-full',
    ];
    const unresolved = density.filter(t => !resolve(document.documentElement, t));
    expect(unresolved).toEqual([]);
  });
});
