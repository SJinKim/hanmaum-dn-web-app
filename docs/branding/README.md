# Dashboard favicon

The favicon reuses the D / cross / N monogram from the mobile login logo.
The original source is preserved in `mobile-login-logo.png` (1200 × 1200,
transparent PNG).

- Mobile source: `hanmaum-dn-mobile-app/composeApp/src/commonMain/composeResources/drawable/logo.png`.
- Login usage: `features/login/screen/LoginScreen.kt`, `Image(painterResource(Res.drawable.logo), …)`.
- Source SHA-256: `5a6527b0c05e0291edc2e8b054a60ec833af512ba418709cd551041eaab5635f`.
- Figma source: [DN-Web · Favicon](https://www.figma.com/design/KSEMYc00jcgvyQ6qWt1cm4/DN-Web?node-id=1325-1072), on `06 · Components — Navigation`.

## Artwork

The monogram is cropped from the original at x=284, y=267, width=654,
height=524. The small “DANIEL & NEHEMIA” subtitle is omitted for legibility.
Its alpha silhouette is preserved and tinted white, following the mobile
login's use of a theme tint. No lettering or cross geometry is redrawn.

The background uses Figma `brand/600` (`#2b3a67`). At 64 × 64 the corner
radius is 12, the mark is 52 pixels wide, and it is centered horizontally
and vertically. The same fixed colors work on light and dark browser tabs.

## Exports

Export the named size frames from Figma as PNG. Export the 64px frame as
SVG with its image embedded so it has no external resource dependencies.
Replace the exported SVG pattern/use wrapper with one direct `<image>`
element at the same bounds. This avoids pattern tiling seams in Chrome;
the embedded PNG and artwork remain identical to the Figma source.

| File in `public/` | Export |
| --- | --- |
| `favicon.svg` | 64px frame, self-contained SVG |
| `favicon.ico` | 16px, 32px and 48px PNG exports in an ICO container |
| `favicon-32x32.png` | 32px PNG fallback |
| `apple-touch-icon.png` | 180px PNG |

`src/index.html` links all four files. Angular copies `public/` into the
production output without an additional asset configuration.
