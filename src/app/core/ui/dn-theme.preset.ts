import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/**
 * DN theme preset — PrimeNG rendered through the Figma token layer (#48).
 *
 * Every value here is a `var(--…)` pointing at src/styles.scss. The mode switch
 * happens there, on `[data-theme="dark"]`, which is why `light` and `dark` below
 * are the *same* object: the custom properties already carry the mode.
 *
 * The `css` blocks are the escape hatch for the two things PrimeNG has no token
 * for: control *height* (Figma sizes controls by height, per breakpoint) and
 * Card's missing `borderColor`. They live here so no feature component ever
 * needs `::ng-deep`.
 */

const focusRing = {
  width: '2px',
  style: 'solid',
  color: 'var(--color-focus)',
  offset: '2px',
  shadow: 'none',
};

/** Colours shared by both schemes — styles.scss flips the underlying values. */
const colorScheme = {
  primary: {
    color: 'var(--color-action-primary)',
    contrastColor: 'var(--color-action-on-primary)',
    hoverColor: 'var(--color-action-primary-hover)',
    activeColor: 'var(--color-action-primary-active)',
  },
  highlight: {
    background: 'var(--color-bg-subtle)',
    focusBackground: 'var(--color-bg-subtle)',
    color: 'var(--color-text-strong)',
    focusColor: 'var(--color-text-strong)',
  },
  mask: {
    background: 'var(--color-scrim)',
    color: 'var(--color-text-muted)',
  },
  formField: {
    background: 'var(--color-bg-surface)',
    disabledBackground: 'var(--color-bg-subtle)',
    filledBackground: 'var(--color-bg-subtle)',
    filledHoverBackground: 'var(--color-bg-subtle)',
    filledFocusBackground: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    hoverBorderColor: 'var(--color-border-strong)',
    focusBorderColor: 'var(--color-focus)',
    invalidBorderColor: 'var(--color-badge-deleted-fg)',
    color: 'var(--color-text-default)',
    disabledColor: 'var(--color-text-disabled)',
    placeholderColor: 'var(--color-text-muted)',
    invalidPlaceholderColor: 'var(--color-badge-deleted-fg)',
    floatLabelColor: 'var(--color-text-muted)',
    floatLabelFocusColor: 'var(--color-focus)',
    floatLabelActiveColor: 'var(--color-text-muted)',
    floatLabelInvalidColor: 'var(--color-badge-deleted-fg)',
    iconColor: 'var(--color-text-muted)',
    shadow: 'none',
  },
  text: {
    color: 'var(--color-text-default)',
    hoverColor: 'var(--color-text-strong)',
    mutedColor: 'var(--color-text-muted)',
    hoverMutedColor: 'var(--color-text-default)',
  },
  content: {
    background: 'var(--color-bg-surface)',
    hoverBackground: 'var(--color-bg-subtle)',
    borderColor: 'var(--color-border-subtle)',
    color: 'var(--color-text-default)',
    hoverColor: 'var(--color-text-strong)',
  },
  overlay: {
    select: {
      background: 'var(--color-bg-surface)',
      borderColor: 'var(--color-border-default)',
      color: 'var(--color-text-default)',
    },
    popover: {
      background: 'var(--color-bg-surface)',
      borderColor: 'var(--color-border-default)',
      color: 'var(--color-text-default)',
    },
    modal: {
      background: 'var(--color-bg-surface)',
      borderColor: 'var(--color-border-default)',
      color: 'var(--color-text-default)',
    },
  },
  list: {
    option: {
      focusBackground: 'var(--color-bg-subtle)',
      selectedBackground: 'var(--color-bg-subtle)',
      selectedFocusBackground: 'var(--color-bg-subtle)',
      color: 'var(--color-text-default)',
      focusColor: 'var(--color-text-strong)',
      selectedColor: 'var(--color-text-strong)',
      selectedFocusColor: 'var(--color-text-strong)',
      icon: {
        color: 'var(--color-text-muted)',
        focusColor: 'var(--color-text-default)',
      },
    },
    optionGroup: {
      background: 'transparent',
      color: 'var(--color-text-muted)',
    },
  },
  navigation: {
    item: {
      focusBackground: 'var(--color-bg-subtle)',
      activeBackground: 'var(--color-bg-subtle)',
      color: 'var(--color-text-default)',
      focusColor: 'var(--color-text-strong)',
      activeColor: 'var(--color-text-strong)',
      icon: {
        color: 'var(--color-text-muted)',
        focusColor: 'var(--color-text-default)',
        activeColor: 'var(--color-text-default)',
      },
    },
    submenuLabel: {
      background: 'transparent',
      color: 'var(--color-text-muted)',
    },
    submenuIcon: {
      color: 'var(--color-text-muted)',
      focusColor: 'var(--color-text-default)',
      activeColor: 'var(--color-text-default)',
    },
  },
};

/** Button severities, identical in both schemes. */
const buttonColorScheme = {
  root: {
    primary: {
      background: 'var(--color-action-primary)',
      hoverBackground: 'var(--color-action-primary-hover)',
      activeBackground: 'var(--color-action-primary-active)',
      borderColor: 'var(--color-action-primary)',
      hoverBorderColor: 'var(--color-action-primary-hover)',
      activeBorderColor: 'var(--color-action-primary-active)',
      color: 'var(--color-action-on-primary)',
      hoverColor: 'var(--color-action-on-primary)',
      activeColor: 'var(--color-action-on-primary)',
      focusRing: { color: 'var(--color-focus)', shadow: 'none' },
    },
    secondary: {
      background: 'var(--color-bg-surface)',
      hoverBackground: 'var(--color-bg-subtle)',
      activeBackground: 'var(--color-bg-subtle)',
      borderColor: 'var(--color-border-default)',
      hoverBorderColor: 'var(--color-border-strong)',
      activeBorderColor: 'var(--color-border-strong)',
      color: 'var(--color-text-strong)',
      hoverColor: 'var(--color-text-strong)',
      activeColor: 'var(--color-text-strong)',
      focusRing: { color: 'var(--color-focus)', shadow: 'none' },
    },
    // Figma "Danger" is the soft variant: tinted surface, red label, red border on hover.
    danger: {
      background: 'var(--color-badge-deleted-bg)',
      hoverBackground: 'var(--color-badge-deleted-bg)',
      activeBackground: 'var(--color-badge-deleted-bg)',
      borderColor: 'var(--color-border-default)',
      hoverBorderColor: 'var(--color-badge-deleted-fg)',
      activeBorderColor: 'var(--color-badge-deleted-fg)',
      color: 'var(--color-badge-deleted-fg)',
      hoverColor: 'var(--color-badge-deleted-fg)',
      activeColor: 'var(--color-badge-deleted-fg)',
      focusRing: { color: 'var(--color-focus)', shadow: 'none' },
    },
  },
  outlined: {
    secondary: {
      hoverBackground: 'var(--color-bg-subtle)',
      activeBackground: 'var(--color-bg-subtle)',
      borderColor: 'var(--color-border-default)',
      color: 'var(--color-text-strong)',
    },
    danger: {
      hoverBackground: 'var(--color-badge-deleted-bg)',
      activeBackground: 'var(--color-badge-deleted-bg)',
      borderColor: 'var(--color-badge-deleted-fg)',
      color: 'var(--color-badge-deleted-fg)',
    },
  },
  // Figma "Ghost" = severity="secondary" + [text]="true".
  text: {
    secondary: {
      hoverBackground: 'var(--color-bg-subtle)',
      activeBackground: 'var(--color-bg-subtle)',
      color: 'var(--color-text-default)',
    },
    danger: {
      hoverBackground: 'var(--color-badge-deleted-bg)',
      activeBackground: 'var(--color-badge-deleted-bg)',
      color: 'var(--color-badge-deleted-fg)',
    },
  },
};

export const DnPreset = definePreset(Aura, {
  semantic: {
    transitionDuration: '0.15s',
    disabledOpacity: '1',
    iconSize: '16px',
    focusRing,
    formField: {
      paddingX: 'var(--space-12)',
      paddingY: 'var(--space-8)',
      borderRadius: 'var(--radius-md)',
      focusRing,
      sm: { fontSize: '12px', paddingX: 'var(--space-8)', paddingY: 'var(--space-4)' },
      lg: { fontSize: '13px', paddingX: 'var(--space-16)', paddingY: 'var(--space-8)' },
      transitionDuration: '0.15s',
    },
    content: { borderRadius: 'var(--radius-lg)' },
    list: {
      padding: 'var(--space-4)',
      gap: '2px',
      option: { padding: 'var(--space-8) var(--space-12)', borderRadius: 'var(--radius-sm)' },
      optionGroup: { padding: 'var(--space-8) var(--space-12)', fontWeight: '600' },
    },
    navigation: {
      list: { padding: 'var(--space-4)', gap: '2px' },
      item: { padding: 'var(--space-8) var(--space-12)', borderRadius: 'var(--radius-sm)', gap: 'var(--space-8)' },
      submenuLabel: { padding: 'var(--space-8) var(--space-12)', fontWeight: '600' },
    },
    overlay: {
      select: { borderRadius: 'var(--radius-md)', shadow: 'var(--shadow-md)' },
      popover: { borderRadius: 'var(--radius-md)', padding: 'var(--space-8)', shadow: 'var(--shadow-md)' },
      modal: { borderRadius: 'var(--radius-lg)', padding: 'var(--space-24)', shadow: 'var(--shadow-lg)' },
      navigation: { shadow: 'var(--shadow-md)' },
    },
    colorScheme: { light: colorScheme, dark: colorScheme },
  },

  components: {
    button: {
      root: {
        borderRadius: 'var(--radius-md)',
        gap: 'var(--space-8)',
        paddingX: 'var(--space-16)',
        paddingY: '0',
        iconOnlyWidth: 'var(--size-icon-button)',
        label: { fontWeight: '600' },
        transitionDuration: '0.15s',
        roundedBorderRadius: 'var(--radius-full)',
        focusRing: { width: '2px', style: 'solid', offset: '2px' },
        sm: {
          fontSize: '12px',
          paddingX: 'var(--space-12)',
          paddingY: '0',
          iconOnlyWidth: 'var(--size-icon-button-sm)',
        },
        lg: { fontSize: '13px', paddingX: 'var(--space-20)', paddingY: '0' },
      },
      colorScheme: { light: buttonColorScheme, dark: buttonColorScheme },
      css: `
.p-button { height: var(--size-control-md); font-size: 12px; letter-spacing: -0.12px; }
.p-button-sm { height: var(--size-control-sm); }
.p-button-icon-only { height: var(--size-icon-button); width: var(--size-icon-button); padding: 0; }
.p-button-icon-only.p-button-sm { height: var(--size-icon-button-sm); width: var(--size-icon-button-sm); }
.p-button:disabled { background: var(--color-bg-subtle); border-color: var(--color-border-subtle); color: var(--color-text-disabled); }
.p-button-text.p-button-secondary:not(:disabled):hover { color: var(--color-text-strong); }
`,
    },

    inputtext: {
      root: { borderRadius: 'var(--radius-md)' },
      css: `
input.p-inputtext { height: var(--size-control-md); }
input.p-inputtext-sm { height: var(--size-control-sm); }
`,
    },

    textarea: {
      root: { borderRadius: 'var(--radius-md)' },
    },

    select: {
      root: { borderRadius: 'var(--radius-md)' },
      dropdown: { width: 'var(--space-32)', color: 'var(--color-text-muted)' },
      option: { padding: 'var(--space-8) var(--space-12)', borderRadius: 'var(--radius-sm)' },
      css: `
.p-select { height: var(--size-control-md); }
.p-select-sm { height: var(--size-control-sm); }
`,
    },

    iconfield: {
      icon: { color: 'var(--color-text-muted)' },
    },

    checkbox: {
      root: {
        borderRadius: 'var(--radius-sm)',
        width: '16px',
        height: '16px',
        borderColor: 'var(--color-border-strong)',
        hoverBorderColor: 'var(--color-action-primary)',
        checkedBorderColor: 'var(--color-action-primary)',
        checkedHoverBorderColor: 'var(--color-action-primary-hover)',
        checkedBackground: 'var(--color-action-primary)',
        checkedHoverBackground: 'var(--color-action-primary-hover)',
        disabledBackground: 'var(--color-bg-subtle)',
        checkedDisabledBorderColor: 'var(--color-border-subtle)',
        shadow: 'none',
        focusRing,
      },
      icon: {
        size: '12px',
        color: 'var(--color-action-on-primary)',
        checkedColor: 'var(--color-action-on-primary)',
        checkedHoverColor: 'var(--color-action-on-primary)',
        disabledColor: 'var(--color-text-disabled)',
      },
    },

    radiobutton: {
      root: {
        width: '16px',
        height: '16px',
        borderColor: 'var(--color-border-strong)',
        hoverBorderColor: 'var(--color-action-primary)',
        checkedBorderColor: 'var(--color-action-primary)',
        checkedHoverBorderColor: 'var(--color-action-primary-hover)',
        checkedBackground: 'var(--color-action-primary)',
        checkedHoverBackground: 'var(--color-action-primary-hover)',
        disabledBackground: 'var(--color-bg-subtle)',
        checkedDisabledBorderColor: 'var(--color-border-subtle)',
        shadow: 'none',
        focusRing,
      },
      icon: {
        size: '8px',
        checkedColor: 'var(--color-action-on-primary)',
        checkedHoverColor: 'var(--color-action-on-primary)',
        disabledColor: 'var(--color-text-disabled)',
      },
    },

    toggleswitch: {
      root: {
        width: '40px',
        height: '22px',
        borderRadius: 'var(--radius-full)',
        gap: 'var(--space-2)',
        borderWidth: '1px',
        borderColor: 'var(--color-border-strong)',
        hoverBorderColor: 'var(--color-border-strong)',
        checkedBorderColor: 'var(--color-action-primary)',
        checkedHoverBorderColor: 'var(--color-action-primary-hover)',
        background: 'var(--color-bg-subtle)',
        hoverBackground: 'var(--color-bg-subtle)',
        checkedBackground: 'var(--color-action-primary)',
        checkedHoverBackground: 'var(--color-action-primary-hover)',
        disabledBackground: 'var(--color-bg-subtle)',
        shadow: 'none',
        focusRing,
      },
      handle: {
        borderRadius: 'var(--radius-full)',
        size: '16px',
        // action/on-primary on the primary track — never text/inverse (WCAG, per Figma).
        background: 'var(--color-border-strong)',
        hoverBackground: 'var(--color-text-muted)',
        checkedBackground: 'var(--color-action-on-primary)',
        checkedHoverBackground: 'var(--color-action-on-primary)',
        disabledBackground: 'var(--color-text-disabled)',
      },
    },

    card: {
      root: { borderRadius: 'var(--radius-lg)', shadow: 'var(--shadow-sm)' },
      body: { padding: 'var(--space-card)', gap: 'var(--space-16)' },
      title: { fontSize: 'var(--font-h2)', fontWeight: '700' },
      css: `
.p-card { border: 1px solid var(--color-border-subtle); }
`,
    },

    dialog: {
      root: {
        borderRadius: 'var(--radius-lg)',
        borderColor: 'var(--color-border-subtle)',
        shadow: 'var(--shadow-lg)',
      },
      header: { padding: 'var(--space-24)', gap: 'var(--space-8)' },
      title: { fontSize: 'var(--font-h2)', fontWeight: '700' },
      content: { padding: '0 var(--space-24) var(--space-16) var(--space-24)' },
      footer: { padding: 'var(--space-16) var(--space-24) var(--space-24) var(--space-24)', gap: 'var(--space-8)' },
    },

    toast: {
      root: { width: '360px', borderRadius: 'var(--radius-lg)', borderWidth: '1px', blur: '0' },
      content: { padding: 'var(--space-16)', gap: 'var(--space-12)' },
      text: { gap: 'var(--space-4)' },
      summary: { fontSize: '12px', fontWeight: '700' },
      detail: { fontSize: '12px', fontWeight: '500' },
      icon: { size: '16px' },
      css: `
.p-toast-message { background: var(--color-bg-surface); border: 1px solid var(--color-border-subtle); box-shadow: var(--shadow-lg); color: var(--color-text-strong); }
.p-toast-detail { color: var(--color-text-muted); }
.p-toast-message-success .p-toast-message-icon { color: var(--color-badge-active-fg); }
.p-toast-message-error .p-toast-message-icon { color: var(--color-badge-deleted-fg); }
.p-toast-message-info .p-toast-message-icon { color: var(--color-badge-ministry-active-fg); }
.p-toast-message-warn .p-toast-message-icon { color: var(--color-badge-inactive-fg); }
`,
    },

    tabs: {
      tablist: { borderWidth: '0 0 1px 0', background: 'transparent', borderColor: 'var(--color-border-subtle)' },
      tab: {
        background: 'transparent',
        hoverBackground: 'transparent',
        activeBackground: 'transparent',
        borderWidth: '0',
        color: 'var(--color-text-muted)',
        hoverColor: 'var(--color-text-default)',
        activeColor: 'var(--color-text-strong)',
        padding: 'var(--space-8) var(--space-12)',
        fontWeight: '600',
        margin: '0',
        gap: 'var(--space-8)',
        focusRing,
      },
      tabpanel: { background: 'transparent', color: 'var(--color-text-default)', padding: 'var(--space-16) 0 0 0', focusRing },
      activeBar: { height: 'var(--space-2)', bottom: '-1px', background: 'var(--color-action-primary)' },
    },

    menu: {
      root: {
        background: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border-subtle)',
        borderRadius: 'var(--radius-md)',
        shadow: 'var(--shadow-md)',
      },
      separator: { borderColor: 'var(--color-border-subtle)' },
    },

    tooltip: {
      root: { borderRadius: 'var(--radius-sm)', padding: 'var(--space-4) var(--space-8)', maxWidth: '240px' },
    },

    // Figma: Data / Table — HeaderCell (113:69), Cell (114:85), Row (114:215).
    // The row height itself is not a PrimeNG token, so `app-data-table` sets it
    // from `--size-table-row`; everything Density does not drive lives here.
    datatable: {
      header: {
        background: 'var(--color-bg-base)',
        borderColor: 'var(--color-border-default)',
        color: 'var(--color-text-default)',
        padding: 'var(--space-12) var(--space-16)',
      },
      headerCell: {
        background: 'var(--color-bg-base)',
        hoverBackground: 'var(--color-bg-subtle)',
        selectedBackground: 'var(--color-bg-subtle)',
        borderColor: 'var(--color-border-default)',
        color: 'var(--color-text-muted)',
        hoverColor: 'var(--color-text-default)',
        selectedColor: 'var(--color-text-strong)',
        gap: 'var(--space-8)',
        padding: 'var(--space-8) var(--space-16)',
        focusRing: { ...focusRing, offset: '-2px' },
      },
      // Overline: the header is a label, never a heading.
      columnTitle: { fontWeight: '700' },
      row: {
        background: 'var(--color-bg-surface)',
        // Hover and Selected are the same fill in Figma; Selected adds a left bar.
        hoverBackground: 'var(--color-bg-subtle)',
        selectedBackground: 'var(--color-bg-subtle)',
        color: 'var(--color-text-default)',
        hoverColor: 'var(--color-text-default)',
        selectedColor: 'var(--color-text-strong)',
        focusRing: { ...focusRing, offset: '-2px' },
      },
      bodyCell: {
        borderColor: 'var(--color-border-subtle)',
        padding: 'var(--space-12) var(--space-16)',
      },
      sortIcon: {
        color: 'var(--color-text-muted)',
        hoverColor: 'var(--color-text-default)',
        size: '16px',
      },
      loadingIcon: { size: '24px' },
      css: `
.p-datatable-column-header-content { font-size: 10px; line-height: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
.p-datatable-tbody > tr { height: var(--size-table-row); }
`,
    },
  },
});
