# Chart and sharing fixes

- Saved Charts now uses the standard portalled dialog. It clears the lower page
  stacking context, sits above the notification bell, and keeps a 44-pixel close
  target visible while its list scrolls. Escape closes it and focus returns to
  the opener.
- Daily and weekly sharing prefer the known rising sign. If birth time is unknown
  or no rising sign exists, they use the known Sun sign instead. Estimated
  ascendants on unknown-time charts are ignored. Sun readings explicitly avoid
  houses and inferred Ascendants, and their image/text labels identify the Sun.
- Shared reading caches separate Sun/rising and day/week, so these variants cannot
  reuse the wrong interpretation. Existing callers still default to rising/day.
- All share cards offer Blue and Cream. The selected theme applies to both the
  preview and actual exported image. An explicit solid background supports the
  image renderer when it cannot reproduce the decorative radial gradient.
- Share sheets scroll on short displays and fit 320-pixel phone widths.
- Landing restores an incoming section anchor after authentication loading and
  React mounting. Email links to `/#home-screen` can now land on the guide without
  requiring another click on the page.

Validation: 15 offline handler/regression tests passed, the production web build
passed, and mobile browser checks covered the portalled close target, a 30-chart
scrolling list, Escape/focus restoration, Sun-share labels, both theme previews,
320-pixel reflow, and a real 1080-pixel cream PNG export. Tests used synthetic
chart data and did not request paid model output.

These web changes are also included in source for the next native builds.
Installed store apps bundle the web assets; they require a new native build and
store release to receive the UI changes. This work does not alter an existing
Apple review submission.
