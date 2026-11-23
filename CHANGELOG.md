# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🎯 Behavior Changes

- `tw-tabs` panel ids are now unique per tab set (`tw-tabs-N-panel-<value>`)
  instead of `panel-<value>`; update any CSS or test selectors that targeted
  the old ids
- `styles/theme.css` is now shipped at the exported path
  (`@quinnjr/ngx-tailwindcss/styles/theme.css`); previously the export pointed
  at a file that was not in the package
- `rxjs` (`^7.4.0`) is now a declared peer dependency
- `@angular/platform-browser` is now a declared peer dependency (public types
  reference `SafeHtml`)
- `tw-button` gains a `type` input (`'button' | 'submit' | 'reset'`, default
  `'button'`): `type="submit"` submits and `type="reset"` resets the enclosing
  `<form>`. Previously a `tw-button` could not submit a form. A
  `type="submit"` button renders a visually hidden native submit button, so
  pressing Enter in a form field submits the form (implicit submission)
- `@angular/cdk` is now an optional peer dependency (nothing imports it)
- `tw-breadcrumb` item `icon` accepts a `TemplateRef` or a `SafeHtml` value
  (`BreadcrumbIcon`); plain strings are still sanitized, which strips `<svg>`
- `tw-popover` with `trigger="click"`/`"manual"` uses dialog semantics
  (`role="dialog"`, trigger `aria-haspopup`/`aria-expanded`/`aria-controls`);
  `hover`/`focus` popovers keep `role="tooltip"` with `aria-describedby`
- `tw-chord-diagram` fingering `fret` values are absolute fret numbers: with
  `baseFret: 5`, a barre on the 5th fret is `fret: 5` (previously `fret: 1`,
  relative to `baseFret`). Fingerings outside the shown fret window are not drawn
- `NoteData.accidental` is the accidental _written_ in front of the note, as in
  standard notation: a note without one takes its pitch from the key signature
  and earlier accidentals in the measure (in G major an F sounds F♯; write
  `'natural'` for F♮). Rendering, playback/export, transposition and imports
  follow these semantics
- Boolean inputs on `tw-stack` (`wrap`, `fullWidth`), `tw-hstack` (`wrap`),
  `tw-progress` (`showValue`, `striped`, `animated`, `indeterminate`) and
  `tw-progress-circular` (`showValue`, `indeterminate`) accept bare attributes
  (`<tw-stack wrap>`)
- `tw-splitter` and `tw-scroll-area` now style the host element directly; the
  inner wrapper `<div>` is gone, so a `class` applies once, on the host.
  `containerRef` (splitter) and `scrollContainerRef` (scroll-area) now
  reference the host element and are available from construction. CSS that
  targeted the removed wrapper must target the host instead
- Status colours were changed for WCAG AA text contrast, so `success`, `info`
  and `warning` look different: solid `warning` buttons, badges, alerts and
  chips and the `tw-progress` inside value use dark text on amber instead of
  white, and `warning` buttons lighten on hover; solid `success` and `info`
  buttons, badges, alerts, chips and progress bars use the darker 700 shade
  (`emerald-700`, `cyan-700`) instead of 600; outline `success`/`warning`/`info`
  badge and chip text is one shade darker. The default `TW_CONFIG` theme
  status colours (`success`, `warning`, `info`) follow the same palette.
  Override with `class` if you relied on the old colours
- Layout components (`tw-grid`, `tw-simple-grid`, `tw-stack`, `tw-vstack`,
  `tw-hstack`, `tw-columns`, `tw-container`, `tw-center`, `tw-square`,
  `tw-circle`, `tw-bleed`, `tw-spacer`, `tw-wrap`, `tw-aspect-ratio`) no longer
  apply a `class` twice. They used to forward `class` to an inner `<div>` while
  Angular also kept the static attribute on the host, so every utility
  (padding, borders, backgrounds, shadows, margins, widths, offsets, outlines,
  animations, ...) landed on two nested boxes. The host element is now the
  styled box itself and the inner wrapper `<div>` is gone: projected content
  sits directly in the host, a `class` overrides conflicting defaults
  (`class="hidden md:flex"`, `class="gap-2"`), and the host fills its
  flex/grid parent like any other element. `tw-square`/`tw-circle` do not
  shrink below `size` in a flex row. CSS that targeted the removed wrapper
  (`tw-stack > div`) should target the host instead
- Music: the browser `NativePlatformService.openFile({ directory: true })`
  throws `UnsupportedOnPlatformError` instead of returning the files inside
  the chosen directory; directory picking needs Tauri or Electron
- `tw-table` removes rows from its selection when they leave `data` (deleted,
  or replaced by re-fetched objects); the next `selectionChange` no longer
  includes them, so code that relied on the selection keeping such rows must
  track them itself

### 🐛 Fixed

- Focus rings survive class merges (`ring-*` groups no longer collapse)
- SSR guards and listener/timer cleanup in `twAutoFocus`, `twLazyImage`,
  `twClickOutside`, `twLongPress`, `twKeyboardShortcut` and `twScrollAnchor`
- Forms: disabled `FormControl` state, checkbox indeterminate/readonly, slider
  clamping, select keyboard navigation over grouped/filtered options, rating
  ids/focus, chips two-way binding
- Overlays and navigation: modal scroll lock and stacked Escape handling,
  dropdown portal restore, tree keyboard navigation, table page clamping
- Display: progress `aria-valuenow` clamped to its range, image preview
  restores body scrolling (also when destroyed while open or opened twice),
  clickable `tw-card` no longer swallows Enter/Space typed in descendants,
  `a[tw-button]` keeps native link semantics
- `tw-avatar-group` shows the `+N` overflow indicator when `total` is not set;
  avatar initials/status are exposed to assistive technology
- `tw-grid` honors `rowGap` or `colGap` when only one of them is set
- `tw-spacer size="auto"` grows inside a flex container
- `tw-bleed` `customAmount` accepts `var(...)`/`calc(...)` values (negative
  margins are built with `calc(-1 * ...)` instead of an invalid `-` prefix)
- `tw-progress` uses its `label` as the progressbar's accessible name
- `tw-center` with `inline` flows inline instead of rendering as a block
- `tw-image` shows an image that finished loading (or failing) before its
  listeners were attached, e.g. during SSR hydration, instead of keeping the
  placeholder up and the image hidden
- `tw-image` `width`/`height` accept CSS lengths (`10rem`, `auto`); only bare
  numbers get a `px` suffix
- Modal, sidebar, overlay and `tw-image` preview share one reference-counted
  body scroll lock: closing stacked layers in any order no longer leaves the
  page locked (or unlocks it while a layer is still open)
- `tw-avatar` shows its fallback when the image failed to load before
  hydration, instead of a broken image
- `twLazyImage` emits `lazyLoaded` inside the Angular zone, so OnPush/zone
  apps update when an image loads
- `tw-slider` without a written value is shown at `min`; `tw-select` disabled
  options expose `aria-disabled`
- `tw-steps` buttons keep an accessible name when `showLabels` is off
- `twDropZone` reports plain-text drops as `type: 'text'`; the preferences
  dialog emits `tabChanged` when a tab is clicked
- `tw-toast` title, message and action text are readable in dark mode
- `tw-progress` label/value text and `tw-timeline` date, title and
  description are readable in dark mode
- Class merging keeps per-side scroll margin/padding (`scroll-mt-*`,
  `scroll-px-*`, ...), per-axis translate (including `translate-z-*`), skew
  and 3D rotate utilities instead of collapsing them into one
- `tw-multiselect` "Select All" is reachable and toggled from the keyboard
  (Enter/Space)
- `tw-code-viewer` match navigation highlights and scrolls to the current match
- Audio analyser: setting a decibel range no longer throws `IndexSizeError`
  when the new range lies outside the current one
- Class merging covers more Tailwind 4 utility groups: text shadow, font
  stretch, font feature settings, gradient stop positions, space reverse,
  transition behavior, per-axis border spacing, logical `bs`/`be`/`s`/`e`
  sides and `(...)` shorthand arbitrary values now merge correctly
- Dark mode: `tw-slider` value, confirm dialog message and cancel button,
  `tw-sidebar` title, `tw-steps` labels and descriptions, `tw-pagination`
  page text and the `tw-divider` label are readable
- `tw-terminal` `variant="light"` uses dark line colours that are readable on
  its white background
- Audio analyser config keys explicitly set to `undefined` fall back to the
  defaults instead of throwing
- `tw-chord-diagram` draws the barre across the strings it covers on
  right-handed diagrams instead of off the right edge
- Read-only `tw-score-editor` disables undo/redo, transpose and part editing
  controls
- `tw-pan-control` knob value arc no longer lights the dial gap at low values
- `tw-pitch-display` removes its drag listeners through the injected
  `DOCUMENT` (SSR safe)
- Dark mode: `tw-tree` node text and selection, `tw-splitter` gutter and
  handle, `tw-sheet-music` page navigation and the `tw-terminal` prompt,
  cursor and timestamps are readable; `tw-time-display variant="minimal"`
  inherits the surrounding text colour
- `twTooltip` disabled or emptied while its show delay is pending no longer
  opens afterwards
- Audio worker `configure()` keys explicitly set to `undefined` keep their
  current values instead of disabling the worker or zeroing its timeout
- `tw-piano-chord` no longer draws note dots for chord notes outside the
  visible octaves
- `tw-note-display` LED bar agrees with the in-tune check at the
  `centsTolerance` boundary
- `tw-sheet-music` emits `parseError` from an effect instead of inside a
  `computed`
- `tw-looper` waveform no longer draws full-height spikes at the right edge
  for short loops
- `tw-avatar-group` draws the separating ring around each rounded avatar
  instead of a square outline around its host element
- `tw-timeline layout="horizontal"` connectors run from one marker to the
  next (they used to start mid-item, below the markers); marker rings match
  the dark background in dark mode instead of showing a white halo
- Visible keyboard focus indicators: `tw-input` with a prefix, suffix or clear
  button rings its wrapper while the input has focus; `tw-tabs` panels,
  `tw-menu` items and `tw-dropdown` items show a focus ring; the confirm
  dialog buttons' focus ring is offset from the button
- Text contrast (WCAG AA) on the music components' fixed dark/light surfaces
  (labels and readouts in the compressor meter, looper, tuner, pitch display,
  graphic/parametric EQ, channel strip, mixer, VU meter, fader, BPM display,
  metronome, audio stats, audio player, pan control, sheet music, note
  display, note input, piano and score editor); `tw-chips` input text and the
  `tw-multiselect variant="filled"` trigger text are readable in both themes
- Inputs that had no effect now apply: `tw-status-bar` `variant`,
  `tw-native-confirm-dialog` `type`, `tw-file-tree` `showDate`,
  `tw-search-bar` `filters`, `tw-settings-panel` `twSettingTemplate` custom
  controls, `tw-tab-panel` `icon` and `tw-pitch-display` `size` (a second
  `[class]` binding replaced its size classes)
- `twRipple` draws one ripple per tap instead of two (touch plus the emulated
  mouse event); `twTooltip` honours an `opacity-*` class in `tooltipClass`
- Touch drag helpers read the lifted finger on `touchend`/`touchcancel`
  instead of throwing
- Text contrast (WCAG AA): outline badge text, the `tw-avatar` count badge,
  the `tw-progress` inside value on `warning`, the `variant="link"` button in
  dark mode and `tw-card-subtitle` on dark filled cards are readable; `tw-menu`
  shortcut labels, `tw-slider` ticks and min/max labels, the `tw-textarea`
  character counter and the native desktop components (file tree, search bar,
  log viewer, command palette, settings, onboarding, ...) meet 4.5:1
- Graphics contrast (3:1): the focus ring of `warning`/`success`/`info`
  buttons, the solid `warning` alert's dismiss focus ring, `neutral` alert
  icons in dark mode, `warning`/`neutral` spinners and the icon on `warning`
  `tw-timeline` icon markers
- Visible keyboard focus on the `tw-lyrics` textarea, the stereo-width pan
  control and the graphic EQ preset search; log viewer level filters expose
  `aria-pressed`
- `tw-select variant="filled"` is applied (the input had no effect)
- Channel strips render their nested controls in dark mode, so their labels
  stay readable on the strip's fixed dark surface
- Graphics contrast (3:1): close/dismiss icons in `tw-modal`, `tw-toast`,
  `tw-sidebar` and the native icon buttons, `tw-toast` variant icons, the
  `tw-menu` submenu chevron, `tw-rating` stars and the music components'
  icons, scales and diagram marks
- `tw-volume-dial` no longer emits after it is destroyed when a form writes a
  value during teardown (e.g. collapsing a mixer section)
- Native (Tauri) `getFileInfo`/`openFile` no longer fail for paths without a
  file extension
- `tw-log-viewer` auto-scroll and `tw-code-viewer` wrap toggles show their
  active state (static colour classes overrode the conditional ones); the
  wrap toggle exposes `aria-pressed`
- `tw-timeline` connectors run through the centre of icon markers instead of
  their left edge (vertical) or top (horizontal)
- Consumer classes override conflicting defaults instead of losing to them by
  Tailwind's utility order: `tw-modal` `classOverride`, `tw-datatable`
  `containerClass`/`toolbarClass` and the music components' `classOverride`
  are merged; `twHoverClass` swaps out conflicting classes while hovered and
  restores them afterwards
- A `class` attribute or `[class]` binding on `tw-button`, `a[tw-button]`,
  `tw-badge`, `tw-alert`, `tw-card` and `tw-card-horizontal` is merged into the
  component's classes, so `class="bg-sky-700 text-white"` replaces the variant
  colours (it used to compete with them and often lost). These components, the
  `tw-card` directives and the layout components accept every `[class]`
  binding form (string, array, `Set` or `{ class: condition }` object)
- Selected, active and error states are visible: `tw-tabs` `pills` (dark mode)
  and `line` (on hover) active tabs, the `tw-input` error border in dark
  mode, the preferences dialog tab, settings panel category, toolbar toggle
  and prompt dialog error border, the `tw-pitch-display` pitch wheel thumb
  and bold fakebook chords
- Native (Tauri) platform service supports the Tauri 2 API (window, file
  system, clipboard and dialogs)
- Visible keyboard focus and accessible names: `tw-note-input`, `tw-waveform`,
  `tw-sheet-music` zoom buttons, `tw-pitch-display` buttons, cents slider and
  key-lock pressed state; clear buttons and chevrons in `tw-input`,
  `tw-select` and `tw-multiselect` meet 3:1
- `tw-checkbox` and `tw-radio` `variant` colours the native control (via
  `accent-*`); dark-mode focus indicators on `tw-input`, its wrapper and the
  `tw-multiselect` filter, with the error border kept while focused
- State no longer lost on hover: `tw-tree` selected node, `tw-splitter`
  divider while dragging
- Native quick switcher closes on a backdrop click; collapsed sidebar items
  are named by their label
- `tw-score-editor` parts are selectable by keyboard; score-editor and
  note-input toolbars have accessible names and pressed state; `tw-looper`
  and `tw-compressor-meter` `minimal` variants follow the page theme; mixer
  sections expose `aria-expanded`
- `twHoverClass` no longer restores a class that a binding removed (or strips
  one a binding added) while the element was hovered
- Unmuting the audio context restores the source gain it had before muting;
  mixer sections honour `collapsed`
- Accessibility: dark-mode error text and required asterisks on `tw-input`,
  `tw-textarea` and `tw-select` meet 4.5:1; the `tw-table` pager marks the
  current page with `aria-current`; `tw-looper` speed buttons expose
  `aria-pressed`; `tw-metronome` exposes pressed states; `tw-time-display`
  includes the total time in its accessible name; `tw-score-editor` dialogs
  have dialog semantics, close on Escape and manage focus; hover and selected
  states on `tw-looper`, `tw-tuner`, `tw-compressor-meter`, `tw-parametric-eq`,
  `tw-lead-sheet` and `tw-scrubber` keep their contrast; native property
  inspector, shortcuts editor and settings panel inputs have accessible names
- `MidiService` send methods round and clamp note, velocity, controller,
  value and program numbers to 0-127, so out-of-range values no longer corrupt
  the MIDI message
- Keyboard access: interactive `tw-tablature` and `tw-sheet-music` notes and
  measures are focusable, named and activated with Enter/Space, with a visible
  focus ring (new `focusRing` input on `tw-note`)
- Accessibility: native theme selector mode, accent colour and font size
  controls have accessible names and pressed state, and the custom colour
  picker shows keyboard focus; the native breadcrumbs path input is named;
  native property inspector text meets 4.5:1; `tw-graphic-eq` and
  `tw-pitch-display` presets expose `aria-pressed`; `tw-looper` mute and
  delete buttons and the `tw-graphic-eq` slider thumbs keep their contrast
- `tw-metronome` beat accent dots are disabled with the metronome and render
  as plain indicators (not buttons) when accents are not editable
- `tw-button` and `a[tw-button]` no longer pin `display: inline-flex` and
  `position: relative` as inline styles, so display and position classes
  (`class="hidden md:inline-flex"`, `class="fixed bottom-4 right-4"`) apply;
  a `classReplace` without a display class still renders as `inline-flex`
- Keyboard: `tw-select` options are no longer separate Tab stops, and
  `tw-select`/`tw-multiselect` close when focus leaves them;
  `tw-native-context-menu` is keyboard operable (focus moves into the menu,
  arrow keys/Home/End, submenus, checkable items, focus returns on close);
  `tw-resizable-panels` separators are focusable and resize from the keyboard
  (with `aria-valuenow`/min/max), and their collapse buttons are shown on
  focus and no longer submit forms; `tw-piano` keys are disabled when the
  piano is disabled
- `TwClassValue` and `twClassValue` are exported from the package
- `MidiService.getNoteInfo` names notes below 0 correctly;
  `MidiService.unmapCCValue` clamps to 0-127 and returns 0 for an empty
  range instead of `NaN`; `MobileSupportService.detectSwipe` reports a finite
  velocity for a swipe measured at 0 ms; `tw-sheet-music` `minimal` notes
  follow dark mode
- Contrast: `tw-splitter` handle, `tw-scroll-area` thumbs, `tw-looper` record
  icon, `tw-graphic-eq` preset descriptions, `tw-metronome` beat dots,
  `tw-transport` hover icons, `tw-piano-chord` active key labels and
  `tw-score-editor` part names
- `twMidiLearn` applies later changes to its range, curve, inverted, channel
  and CC inputs to its existing mapping
- `tw-lead-sheet`: the `with-staff` display mode and measure `melody` are
  documented as not yet supported (`with-staff` renders like `chords-only`
  and logs a one-time dev-mode warning)
- Keyboard: `tw-waveform` keyboard seeking pans a zoomed view to the seek
  position; `tw-parametric-eq` bands adjust Q with PageUp/PageDown;
  `tw-graphic-eq` preset menu exposes `aria-expanded` and closes on Escape;
  `tw-vu-meter` latched clip indicators can be reset with a focusable button;
  native `tw-tab-bar` tabs reorder with Ctrl/Cmd+Shift+PageUp/PageDown;
  `tw-log-viewer` rows are focusable; in the native quick switcher, Enter on
  a focused button activates that button
- Accessibility: `tw-rating` announces half-step values; onboarding wizard
  step dots meet 3:1 and the current step is wider; dark-mode hover states
  keep their contrast on `tw-menu` shortcuts, `tw-table` rows and pager and
  `tw-tree` chevrons
- Accessibility: `tw-select` and `tw-multiselect` triggers use
  `role="combobox"`, so the active option and required state are announced;
  `tw-radio-group` gains `ariaLabel`/`ariaLabelledby` inputs to name the
  group; disabled `tw-dropdown` items are actually disabled; `tw-tree` focus
  returns to the tree item after clicking its toggle or checkbox; a labelled
  `tw-divider` exposes its label as the separator's accessible name
- Native: `tw-log-viewer` uses a single roving tab stop and shows the
  selected row; the quick switcher returns focus to the element that opened
  it; the "All Files" file-dialog filter no longer restricts the picker, and
  `FileFilter` accepts readonly presets
- Music: `tw-note-input` keyboard note entry appends after the last note;
  `tw-note-display`'s accessible name includes cents, tuning status and
  frequency; `tw-chord-diagram` draws the top edge of the fretboard when the
  diagram starts above the nut; `tw-graphic-eq` clears the active preset
  after a manual band edit
- Contrast: `tw-oscilloscope` and `tw-parametric-eq` light variants,
  `tw-pan-control` chips, `tw-bpm-display` LED label, `tw-scrubber` markers,
  `tw-sheet-music` zoom label and `tw-note-input` undo/redo buttons
- `twLazyImage` loads the new image when its source changes and ignores a
  stale preload that finishes late; `tw-multiselect` marks the control
  touched when focus leaves it, so `updateOn: 'blur'` commits its value;
  disabled `tw-tree` nodes have disabled checkboxes
- Native: `tw-menu-bar` submenus open on click, hover and ArrowRight and are
  keyboard navigable; `tw-search-bar` suggestions stay open while focus is
  inside them; `tw-settings-panel` highlights the shown category with
  `aria-current`; `tw-context-menu` supports radio items; the toolbar
  dropdown, tab-bar overflow and property-inspector categories expose
  `aria-expanded`; unsaved tabs are announced; text contrast fixes in the
  about, prompt and preferences dialogs, log viewer, command palette, quick
  switcher, menus, toolbar and shortcuts editor
- Music: `minimal` `tw-tablature`, `tw-chord-diagram` and `tw-piano-chord`
  follow the page theme; `tw-graphic-eq` clears the active preset when the
  form writes different values; `tw-pan-control` knob L/R labels no longer
  overlap the value arc; `tw-fader` dB unit meets contrast on `minimal`;
  `tw-audio-stats` shows no lossy badge for unknown codecs
- Forms with `updateOn: 'blur'` now commit `tw-rating` clears, `tw-graphic-eq`
  preset and reset buttons, `tw-pan-control` drag and double-click reset, and
  `tw-fader` double-click reset (the control is marked touched)
- `twKeyboardShortcut` moves its listener when `shortcutGlobal` changes;
  `twLazyImage` restarts a pending load when `lazyDisabled`,
  `lazyRootMargin` or `lazyNative` change
- Native: the `tw-toolbar` dropdown closes on outside click and on Escape,
  returning focus to its trigger
- Music: `minimal` `tw-piano-chord` chord-type label meets text contrast
- Class merging resolves conflicts for aspect-ratio, object-fit/position,
  order, filter and backdrop-filter utilities, so overrides such as
  `backdrop-blur-none` win
- Native: Escape closes the preferences, update (when not mandatory),
  onboarding (when skippable) and prompt dialogs from anywhere inside them,
  and closes `tw-search-bar` suggestions while focus is inside them
- `tw-sidebar` gains `ariaLabel`/`ariaLabelledBy` inputs to name header-less
  sidebars
- Music: a disabled `tw-looper` also disables its layer, volume and speed
  controls; `tw-piano` shows the pressed state on highlighted keys and has
  AA-contrast focus rings; `tw-musical-symbol` renders the accent glyph;
  `tw-chord-diagram` fret label is no longer clipped; `tw-tablature` string
  lines are visible in dark mode; `aria-label` on `tw-piano`, `tw-tablature`,
  `tw-lead-sheet`, `tw-sheet-music` and `tw-score-editor` is exposed
  (`role="group"`)
- `tw-progress-circular` gains a `label` input that names its progressbar
  (`aria-label`)
- Class merging resolves conflicts for the remaining Tailwind v4 utility
  families (columns, breaks, overscroll, `sr-only`/`not-sr-only`, grid flow,
  typography details, decoration, divide, inset shadow/ring, mix-blend,
  drop-shadow, will-change, 3D transforms, appearance, color-scheme, caret,
  accent, touch, scroll-snap, fill and stroke)
- Native: stacked native dialogs and library overlays close one at a time on
  Escape, topmost first
- `tw-select` and `tw-multiselect` scroll the keyboard-active option into view
- Accessible names: `tw-tree` gains `ariaLabel`/`ariaLabelledBy`; click and
  manual `tw-popover` dialogs without a `header` gain
  `ariaLabel`/`ariaLabelledBy`; `tw-table` is named by its `title` or by new
  `ariaLabel`/`ariaLabelledBy` inputs; `tw-datatables` is named by its `title`
  or a new `ariaLabel` input
- Music: the browser `openFile` result exposes the picked `File`
  (`FileInfo.file`); `tw-mixer` section headers are disabled when the mixer is
  disabled
- Class merging: legacy `decoration-clone`/`decoration-slice` conflict with
  `box-decoration-*`; arbitrary `drop-shadow` colours
  (e.g. `drop-shadow-[#f00]`) no longer replace the drop-shadow size
- Native: menus, dropdowns, overflow menus, search suggestions and shortcut
  recording inside a dialog close first on Escape instead of closing the dialog
- `tw-select` shows a focus ring on the keyboard-active option when it is also
  the selected one
- Disabled `tw-menu` items no longer open their submenu on hover
- `tw-progress` gains `ariaLabel`/`ariaLabelledBy` inputs that name the
  progressbar without rendering a visible `label` caption
- Music: `tw-piano` clears its MIDI status when the device is unplugged;
  `tw-note-input` `#` toggles a sharp on US keyboard layouts; the
  `tw-pitch-display` snapped bend control is keyboard-operable; `tw-waveform`
  draws the played colour and overlay correctly when the playhead is past the
  visible view and shows the hover time label; `tw-compressor-meter` places
  its 0 dB scale label correctly; `tw-channel-strip`, `tw-metronome`,
  `tw-bpm-display` and the `tw-mixer` scroll buttons show disabled styling
- Disabled `tw-tree` nodes can no longer be expanded or collapsed by the
  chevron or the arrow keys
- Native: focus returns to the trigger after choosing a `tw-toolbar` dropdown
  item or a `tw-tab-bar` overflow action; `tw-shortcuts-editor` keeps focus on
  the shortcut when recording starts and ends
- Music: `tw-note-input` `V` cycles voices and AltGr `#` toggles a sharp, and
  its voice tooltips match the shortcuts; `tw-fader` scale, ticks and pointer
  line up with the cap's travel; `tw-pan-control` knob, `tw-looper` and
  `tw-pitch-display` show disabled styling; the `tw-waveform` hover time label
  stays inside the view; `tw-parametric-eq` axis and node labels stay on the
  canvas; `tw-oscilloscope` amplitude labels follow the gain; the
  `tw-pitch-display` wheel labels and thumbs are visible
- Focus is kept when the focused control disappears or becomes disabled:
  native breadcrumbs, command palette, quick switcher, onboarding wizard,
  update dialog and search bar; toasts dismissed one after another;
  `tw-pagination` and `tw-table` pager buttons; `tw-rating` clear; removing
  the last `tw-chip`; dismissing a `tw-alert` moves focus to the next control
  on the page
- Native: Escape in the `tw-breadcrumbs` path editor no longer closes the
  surrounding dialog
- `tw-multiselect` options that are both keyboard-active and selected show one
  background
- Music: `tw-note-input` undo, redo and delete honour `editable=false`, and its
  help text shows the real flat key; `tw-bpm-display` slider fill, value
  bubble and marks line up with the thumb; the `tw-pan-control` stereo-width
  cap passes pointer input through; the `tw-waveform` hover label is visible in
  short views
- Focus is kept when the focused control disappears or becomes disabled:
  toasts removed by their timer, the toast limit or `dismissAll()`; choosing a
  `tw-select` option with the mouse; removing the only `tw-chip` when
  `allowAdd` is off; `tw-note-input`, `tw-score-editor` and `tw-sheet-music`
  buttons that disable or remove themselves. A dismissed `tw-alert` skips
  controls inside closed `<details>` or hidden containers
- Music: `tw-note-input` ignores MIDI notes when not editable; a disabled
  `tw-piano` ignores MIDI note-on; disabled `tw-transport`, `tw-metronome`,
  `tw-mixer` scroll, `tw-bpm-display`, `tw-looper`, `tw-pitch-display` and
  `tw-waveform` zoom buttons no longer change colour on hover; `tw-graphic-eq`
  lists custom presets that have no category
- Native: the `tw-quick-switcher` clear icon has enough contrast
- Focus is kept when the focused control is clicked away or disables itself:
  clicking a `tw-multiselect` option (or "Select All") keeps focus on the
  trigger or filter; `tw-bpm-display` step and tempo multiplier buttons and
  the `tw-mixer` scroll buttons
- A hover/focus `tw-popover` that hides while focus is inside it no longer
  reopens (and duplicates its popup) when focus returns to the trigger
- Music: `tw-compressor-meter` gain-reduction scale labels line up with the
  depth they mark; `tw-graphic-eq` lists custom presets whose category is not
  enabled under Custom; disabled `tw-parametric-eq` band chips are readable
  instead of faded to 40% opacity
- `tw-popover` and `tw-dropdown` no longer build a duplicate portal when
  closed and reopened within the same tick
- `tw-menu` returns focus to the submenu trigger when the pointer leaves a
  submenu that holds focus, instead of dropping focus to the page
- `tw-table` drops selected rows that are no longer in its `data`, so the
  selection (and later `selectionChange` emissions) no longer reports stale
  rows
- Native: the `tw-window-controls` maximize button announces "Enter full
  screen"/"Exit full screen" when `showFullscreen` is on
- Music: tenor-clef key signatures draw G# inside the staff; the `tw-looper`
  buttons, `tw-waveform` zoom buttons and `tw-pitch-display` semitone buttons
  keep focus when they disable or remove themselves
- Native services, music components and audio services: many correctness and
  resource-cleanup fixes
- Documentation: the README and docs quick start tell you to register an
  animations provider (`provideAnimationsAsync()`), without which `tw-modal`,
  `tw-confirm-dialog` and `tw-overlay` throw NG05105 when opened
- Documentation: corrected package name and documented APIs; demo labels,
  headings and inline code on the docs site are readable in dark mode;
  icon-only buttons and links in the docs demos and examples have accessible
  names

## [1.1.1] - 2026-11-23

### 🐛 Fixed

- Unused components are now tree-shaken from consumer bundles. `TW_ALL` and
  `TW_DIRECTIVES` were top-level arrays built with spread, which bundlers treat
  as side-effectful, so every component, directive and service in the library
  was kept in every app. An app importing only `TwButtonComponent` drops from
  1.36 MB to 128 kB of `main.js` (#66)
- Restore the published package name `@quinnjr/ngx-tailwindcss` and
  `publishConfig.access: public`, which were dropped on `develop` after 1.1.0

### 🛠 CI/CD & Tooling

- Build against Angular 22.3 (library peer range unchanged:
  `^19 || ^20 || ^21 || ^22`) (#64)
- Lint rule rejecting top-level array spread in library source, to keep the
  tree-shaking fix from regressing (#66)
- Fix the CI formatting check and enforce LF line endings via
  `.gitattributes` (#65)

## [1.1.0] - 2026-07-27

A full-project conformance and efficiency audit found 255 gaps between what
the library documented and what it actually did. This release closes all of
them. Most fixes make previously inert APIs start working, so components may
begin reacting to inputs that silently did nothing before.

### 🎯 Behavior Changes

- Inputs that were silently ignored now take effect. Roughly 20 components
  built their class strings in a `computed()` that read plain `@Input()`
  fields, so the value was frozen after first render — `variant`, `size`,
  `error`, `classOverride`, `data`, and `options` now update on every change
  (card, alert, accordion, input, textarea, multiselect, datatable, table,
  tabs, sidebar, scroll-top, tree, and others)
- `tw-button` now blocks activation while `disabled`; consumer `(click)`
  handlers previously still fired because the host is a custom element
- Removed inputs that were never read: `tw-score-editor`'s `musicXml` and
  `abcNotation` (no importer existed) and `tw-lead-sheet`'s `showMelodyLine`,
  `staffClef`, `staffWidth`, and `staffHeight`
- `NativePlatformService.saveFile()` and `fileExists()` now throw
  `UnsupportedOnPlatformError` in the browser instead of returning a
  fabricated path or a bare `false`
- `twMidiLearn`'s `enableContextMenuLearn` now defaults to `false`; applying
  the directive no longer suppresses the browser context menu by default
- `MobileSupportService.shouldAllowAction()` is now a pure check; call the new
  `consumeAction()` to start the cooldown
- `tw-splitter` panes project through `twSplitterPaneStart` and
  `twSplitterPaneEnd`; the previous `:first-of-type` selectors silently
  dropped both panes
- `tw-steps`' `activeIndex` is now a `model()` and no longer coerces string
  attribute values

### ✨ Added

- Angular 22 is now declared in the published peer ranges. The library was
  already built and tested against it, so Angular 22 consumers no longer get
  a spurious peer-dependency warning
- `tw-visualizer` gained a `demoMode` input. Without it the component no
  longer fabricates data or emits synthetic `beatDetected` events
- `tw-sidebar` supports the documented `[(visible)]` two-way binding;
  `visibleInput` remains as a deprecated alias
- `tw-table` renders header and row action templates and a rows-per-page
  selector; `tw-pagination` renders first/last controls
- `TwAccordionHeaderDirective` for projecting custom accordion headers
- Test suite grew from 223 to 1,517 tests, covering the previously untested
  core services and the native, music, table, and multiselect modules

### 🐛 Fixed

- `provideTwConfig()` deep-merges partial themes; overriding one variant no
  longer deletes the other defaults
- `provideTwLocale()` is now consumed by `TwI18nService` instead of being a
  no-op token
- Class merging resolves negative values, `!important`, shorthand/longhand
  conflicts, and arbitrary values containing `:`, with axis-aware groups for
  `overflow`, `translate`, `gap`, `flex`, and `scroll`
- `ControlValueAccessor` contracts now reflect `writeValue`/`setDisabledState`
  under OnPush (checkbox, switch, input, textarea, multiselect, fader), and
  `tw-radio-group` reports `touched`
- Modal backdrop clicks reach the close handler; popover moves projected
  content into its portal instead of cloning it, preserving bindings and
  event handlers
- Implemented previously hollow APIs: `tw-overlay`'s `lockScroll`, dropdown
  trigger `aria-expanded`, popover's `focus` trigger, breadcrumb `icon`,
  vu-meter `value`/`leftValue`/`rightValue`, and tree selection rendering
- Native platform integration works: Tauri is actually detected, the file
  picker, updater, tray, notification, and dock services gate on the real
  runtime, `NativeIpcService.off()` unsubscribes, and the custom title bar
  is draggable
- Fixed memory leaks from animation frames, intervals, MIDI handlers, and
  document drag listeners that outlived component destruction
- Replaced runtime-interpolated Tailwind classes that the scanner could never
  emit (responsive grid and columns, overlay `z-index`, splitter gutter,
  spinner colors) and the `max-w-screen-*` utilities removed in Tailwind v4
- `tw-rating` renders and selects half stars correctly
- `TwMetronomeComponent` schedules clicks on the audio clock with lookahead
  instead of drifting `setInterval` timing

### ♿ Accessibility

- Keyboard support for buttons, menus, dropdowns, listboxes, selects, trees,
  tables, steps, ratings, sliders, splitters, and music controls
- Dialog semantics and focus traps for modal-style overlays, correct
  `aria-expanded`/`aria-sort`/`aria-current`/`aria-checked` states, accessible
  names for icon-only controls, and live-region fixes for toasts and alerts

### 🛠 CI/CD & Tooling

- Node 22.13+ is now required for development; pnpm 11.17.0 is pinned via
  `packageManager` and the CI matrix runs 22.x and 24.x
- Release workflow publishes the correct version, fails loudly when npm
  publish fails, and uses the generated changelog; GitHub Pages deploys
  through a single path
- `prepare` no longer runs a full library build on every install
- Lint is enforced in CI again after clearing all outstanding errors

### 📚 Documentation

- Package identity unified to `ngx-tailwindcss` across the README,
  docs, and examples; authorship rebranded to Joseph R Quinn
- Corrected demo pages and code snippets that referenced inputs and outputs
  the library never had
- Removed fabricated `.well-known` API descriptors and stale codemod scripts

## [0.4.0] - 2026-01-13

### 🎯 Breaking Changes

- **Native App Support**: Tauri and Electron packages are now **optional** peer dependencies
  - The library still works perfectly without them - all imports are dynamic
  - Install `@tauri-apps/*` packages only if you need native app features
  - Install `electron` only if you're building an Electron app
  - Native components gracefully fall back to web equivalents when these packages aren't installed

### 🔒 Security

- Added CodeQL security analysis workflow for automated vulnerability scanning

### 🛠 CI/CD & Dependencies

- Bumped GitHub Actions dependencies:
  - `actions/checkout` from 4 to 6
  - `actions/setup-node` from 4 to 6
  - `actions/configure-pages` from 4 to 5
  - `actions/upload-artifact` from 4 to 6
  - `actions/upload-pages-artifact` from 3 to 4
  - `orhun/git-cliff-action` from 3 to 4
  - `github/codeql-action` from 3 to 4
  - `amannn/action-semantic-pull-request` from 5 to 6
- Bumped Angular dependencies in docs to 21.0.6:
  - `@angular/core`
  - `@angular/common`
  - `@angular/compiler`
  - `@angular/compiler-cli`
  - `@angular/platform-browser`

## [0.3.4] - 2025-12-31

### 🐛 Bug Fixes

- **Volume Dial**: Refactored to use Angular's `model()` input for proper two-way binding support, fixing `NG0303` warning about `value` not being a known property
- **Pagination**: Fixed `NG0955` duplicate keys warning by using unique identifiers for left/right ellipsis in page number arrays
- **Native Components**: Fixed bundler resolution errors for Tauri/Electron imports in web-only applications by implementing dynamic import utilities that prevent static analysis
- **Dock Service**: Fixed `setBadge` method to properly use the `text` parameter by appending badge count to window title in Tauri (was previously calling `getCurrentWindow()` without using the result)

### 🧹 Code Quality

- Removed redundant `valueChange` output from volume dial (now handled automatically by `model()`)
- Cleaned up unused imports in volume dial component
- Added `dynamic-import.ts` utility for runtime-only imports of optional dependencies (Electron, Tauri)
- Updated native services to use dynamic import utilities: FilePickerService, SystemTrayService, DockService, NativeNotificationsService, UpdateService

## [0.3.3] - 2025-12-31

### 🎨 Dark Mode & UI Improvements

- Added dark mode variants to ghost and outline button variants
- Fixed ghost button icon visibility in dark mode
- Fixed avatar ring shapes (add rounded-full to prevent square rings)
- Fixed notification badge clipping (move outside button overflow)
- Removed redundant rounded corners from terminal and log-viewer
- Increased terminal and log-viewer demo heights to prevent cutoff
- Fixed DAW mixer fader styling (rectangular instead of rounded)

### 📦 Dependencies

- Updated `@angular/router` to 21.0.6 to match other Angular packages

## [0.3.2] - 2025-12-30

### 🛠 CI/CD Fixes

- Fixed GitHub Pages deployment for documentation
- Removed CNAME configuration for github.io deployment
- Deployed docs from main branch instead of release tags
- Allow docs deployment even if npm publish fails

## [0.3.1] - 2025-12-29

### 🧪 Testing

- Added comprehensive unit test coverage (1006 tests)
- All components now have spec files with thorough testing
- Fixed test utilities and improved test infrastructure

## [0.3.0] - 2025-12-28

### ✨ Native App UI Components

Complete suite of UI components for building desktop-like applications with Tauri, Electron, or PWAs:

#### Window & Chrome Components
- **Title Bar** - Custom draggable title bar with platform-specific controls
- **Window Controls** - macOS traffic lights, Windows, and Linux style buttons
- **Menu Bar** - Native-style menu bar with keyboard navigation
- **Context Menu** - Right-click context menus with submenus

#### Navigation Components
- **Sidebar** - Collapsible sidebar with tree navigation
- **File Tree** - Hierarchical file/folder explorer
- **Breadcrumb Navigation** - Path-based breadcrumbs
- **Tab Bar** - Document tabs with close/reorder

#### Search & Commands
- **Command Palette** - VS Code-style command palette (Cmd+K)
- **Search Bar** - Global search with suggestions
- **Quick Switcher** - Quick file/tab switcher

#### Settings & Preferences
- **Settings Panel** - Categorized settings layout
- **Preferences Dialog** - macOS-style preferences
- **Keyboard Shortcuts Editor** - Visual shortcut editor
- **Theme Selector** - Light/Dark/System mode toggle

#### Dialogs & Notifications
- **Alert Dialog** - Info, Warning, Error, Success variants
- **Confirm Dialog** - Confirmation with custom buttons
- **Prompt Dialog** - Text input prompts
- **About Dialog** - App info with version, credits
- **Update Dialog** - Update available notifications
- **Onboarding Wizard** - Step-by-step introductions

#### Data Display
- **Property Inspector** - Key-value property display
- **Terminal/Console** - Terminal output with ANSI colors
- **Log Viewer** - Log entries with filtering
- **Code/JSON Viewer** - Syntax highlighted code display

#### Status & Feedback
- **Status Bar** - Bottom status bar with sections
- **Toolbar** - Icon buttons with overflow menu
- **Activity Indicator** - Loading states
- **Connection Status** - Online/offline indicators

#### Interaction & Input
- **Resizable Panels** - Drag-to-resize split panels
- **Keyboard Shortcut Display** - Visual key combinations
- **Drag & Drop Directives** - twDraggable, twDropZone
- **Shortcut Directive** - twShortcut for keyboard bindings

### 🔧 Services

- `NativeAppPlatformService` - Window management, system info
- `StorageService` - Local, secure, and file storage
- `IpcService` - Tauri/Electron IPC communication
- `UpdateService` - App update management
- `FilePickerService` - Native file/folder dialogs
- `SystemTrayService` - System tray icon and menu
- `NativeNotificationsService` - System notifications
- `DockService` - Dock/taskbar integration

## [0.2.0] - 2025-12-26

### ✨ Music/Audio Components

Professional DAW-style audio components for music applications:

- **Piano Keyboard** - Interactive piano with MIDI support
- **Volume Dial** - Rotary volume/parameter control
- **Mixer Faders** - Multi-channel mixing interface
- **Waveform Display** - Audio waveform visualization
- **Spectrum Analyzer** - Real-time frequency display
- **VU Meter** - Level metering with peak hold
- **Transport Controls** - Play/pause/stop/record buttons
- **Timeline Ruler** - Time/beat markers

### 🔧 Audio Services

- `AudioContextService` - Web Audio API management
- `MidiService` - MIDI device integration
- `MobileSupportService` - Touch device optimization
- `AccessibilityService` - Screen reader support for audio controls

## [0.1.2] - 2025-12-21

### 🛠 Packaging & Reliability

- Copied `README.md` into the published `/dist/ngx-tailwindcss` output so npmjs can render the project documentation even when the tarball is built from the compiled library.
- Added a `publish:dist` script that runs the production build and publishes directly from `dist/ngx-tailwindcss` with `--access public`, keeping the published artifact aligned with the compiled bundle.
- Raised the Vitest hook and test timeouts to 60 s so the longer-running directive specs no longer abort the Husky pre-push step.

## [0.1.1] - 2025-12-19

### 🛠 Packaging & Reliability

- Ensured the npm release is produced from the compiled `/dist/ngx-tailwindcss` output so the published tarball includes the FESM bundle, typings, and theme CSS instead of just docs/config files.
- Replaced the deprecated `husky install` step with a runtime `node -e "import('husky')..."` bootstrap and added dedicated pre-commit/pre-push/commit-msg scripts so lint/test/commitlint hooks run reliably without invoking the removed shim.

## [0.1.0] - 2025-12-19

### ✨ Features

- Introduced a configurable theming system based on CSS custom properties, the `TwThemeService`, and `provideTwTheme()` so apps can swap palettes, override individual components, and keep `dark:` styles optional.
- Added a default `theme.css` bundle with semantic light/dark values and exposed the CSS variables through `ng-packagr` assets, letting downstream consumers tweak every shade without touching the library source.
- Delivered `TwDatatablesComponent`, a ready-to-go dashboard table with headers, toolbar slots, filters, pagination, and selection wired to the existing `tw-table` data layer.

### 📝 Content & polish

- Documented how to configure themes and added the DataTables docs page, ensuring the sidebar, nav, and theming routes all reach the new experiences.
- Rebalanced the docs palette so dark mode text, containers, stack/grid/spacer demos, sticky/scroll-area/columns/bleed examples, and tabs are legible, spacing works, and the navbar no longer looks cramped.
- Fixed the horizontal spacer sample to honor `size="auto"` by giving it `flex-1` and updated copy snippets throughout the docs to reflect the new UX.

### 🛠 Tooling & quality

- Added comprehensive `.npmignore`, removed single-use scripts, and wired Husky with linting pre-commit, test pre-push, and commitlint hooks.
- Documented the new changelog entry, ensured dark-mode demos showcase `dark:text-slate-300`, and kept existing Tailwind `dark:` utilities as safe defaults while giving users CSS variable overrides for Tw components.

## [0.1.0-beta.1] - 2025-12-15

### 🎉 Initial Release

First public release of `ngx-tailwindcss` - A highly customizable Angular component library for Tailwind CSS 4+.

### ✨ Features

#### Core
- **TwClassService** - Intelligent Tailwind class merging with conflict resolution
- **Global Configuration** - `provideTwConfig()` for app-wide default styling
- **Class Override System** - `classOverride` and `classReplace` inputs on all components

#### Form Components
- **Button** - Multiple variants (primary, secondary, outline, ghost, link, danger), sizes, icons, loading states
- **Input** - Text, password, email, number inputs with validation, prefixes, suffixes
- **Checkbox** - Single and group checkboxes with indeterminate state
- **Radio** - Radio buttons with group support
- **Switch** - Toggle switches with labels
- **Select** - Dropdown select with search, multi-select, custom templates
- **Slider** - Range sliders with single/dual handles, steps, marks
- **Rating** - Star rating with half-star support

#### Layout Components
- **Card** - Flexible card layouts with header, body, footer directives
- **Accordion** - Collapsible panels with single/multiple open modes
- **Tabs** - Tab navigation with lazy loading support
- **Divider** - Horizontal/vertical dividers with labels

#### Data Display Components
- **Badge** - Status indicators with variants and sizes
- **Avatar** - User avatars with images, initials, status indicators, groups
- **Chip** - Removable chips/tags
- **Table** - Data tables with sorting, pagination, row selection
- **Tree** - Hierarchical tree view with expand/collapse
- **Timeline** - Vertical timeline for events

#### Navigation Components
- **Breadcrumb** - Navigation breadcrumbs with custom separators
- **Pagination** - Page navigation with customizable display
- **Steps** - Step indicators for multi-step processes
- **Menu** - Context menus and menu bars

#### Feedback Components
- **Alert** - Dismissible alerts with variants (info, success, warning, error)
- **Toast** - Toast notifications with positioning and auto-dismiss
- **Progress** - Linear and circular progress bars
- **Spinner** - Loading spinners (border, dots, pulse, bars)
- **Skeleton** - Loading placeholders (text, cards, tables)

#### Overlay Components
- **Modal** - Dialog modals with sizes and animations
- **Dropdown** - Dropdown menus with portal rendering
- **Sidebar** - Slide-out sidebar panels
- **Popover** - Floating popovers with positioning

#### Media Components
- **Image** - Responsive images with lazy loading, preview mode

#### Utility Components
- **ScrollTop** - Scroll-to-top button

### 🎯 Directives

#### Core Directives
- **TwRippleDirective** - Material-style ripple effects
- **TwTooltipDirective** - Tooltip on hover
- **TwClickOutsideDirective** - Detect clicks outside element
- **TwFocusTrapDirective** - Trap focus within modals

#### DX Enhancement Directives
- **TwAutoFocusDirective** - Auto-focus elements on render
- **TwInViewDirective** - Intersection Observer for visibility
- **TwLongPressDirective** - Detect long press gestures
- **TwDebounceClickDirective** - Debounce rapid clicks
- **TwCopyClipboardDirective** - Copy text to clipboard
- **TwKeyboardShortcutDirective** - Handle keyboard shortcuts
- **TwSwipeDirective** - Detect swipe gestures
- **TwResizeObserverDirective** - Observe element resize
- **TwLazyImageDirective** - Lazy load images
- **TwScrollToDirective** - Smooth scroll navigation
- **TwHoverClassDirective** - Dynamic hover classes
- **TwTrapScrollDirective** - Prevent scroll propagation

#### ARIA Accessibility Directives
- **TwSrOnlyDirective** - Screen reader only content
- **TwAnnounceDirective** - Screen reader announcements
- **TwAriaExpandedDirective** - Manage expanded state
- **TwAriaSelectedDirective** - Manage selected state
- **TwAriaCheckedDirective** - Manage checked state
- **TwAriaPressedDirective** - Manage pressed state
- **TwAriaDisabledDirective** - Manage disabled state
- **TwAriaHiddenDirective** - Hide from assistive tech
- **TwAriaLiveDirective** - Live region management
- **TwAriaCurrentDirective** - Current navigation item
- **TwAriaBusyDirective** - Busy/loading state
- **TwAriaDescribedbyDirective** - Description relationships
- **TwAriaLabelledbyDirective** - Label relationships
- **TwAriaLabelDirective** - Accessible labels
- **TwAriaValueDirective** - Range widget values
- **TwRoleDirective** - ARIA roles
- **TwAriaModalDirective** - Modal dialogs
- **TwAriaHaspopupDirective** - Popup indicators

### ♿ Accessibility
- **TwAriaService** - Screen reader announcements (polite/assertive)
- **AriaUtils** - Helper functions for ARIA IDs and attributes
- All components built with WCAG 2.1 guidelines
- Keyboard navigation support
- Focus management

### 🌐 Internationalization
- **TwI18nService** - Translation and locale management
- **provideTwTranslations()** - Custom translation provider
- **provideTwLocale()** - Locale configuration
- Default English translations for all components
- RTL language support (Arabic, Hebrew, Persian, Urdu, etc.)
- String interpolation for dynamic content

### 📚 Documentation
- Comprehensive docs website with live examples
- Interactive component demos
- Code snippets with copy functionality
- SEO optimized with Open Graph and Twitter Cards
- AI-friendly documentation (llms.txt, structured data)

### 🛠️ Developer Experience
- Angular 19, 20, and 21 support
- Standalone components (no NgModule required)
- Full TypeScript support with strict types
- Tree-shakeable exports
- Zero bundled CSS - works with your Tailwind config
- Signals-based reactive state management

[0.4.0]: https://github.com/quinnjr/ngx-tailwindcss/releases/tag/v0.4.0
[0.3.4]: https://github.com/quinnjr/ngx-tailwindcss/releases/tag/v0.3.4
[0.3.3]: https://github.com/quinnjr/ngx-tailwindcss/releases/tag/v0.3.3
[0.3.2]: https://github.com/quinnjr/ngx-tailwindcss/releases/tag/v0.3.2
[0.3.1]: https://github.com/quinnjr/ngx-tailwindcss/releases/tag/v0.3.1
[0.3.0]: https://github.com/quinnjr/ngx-tailwindcss/releases/tag/v0.3.0
[0.2.0]: https://github.com/quinnjr/ngx-tailwindcss/releases/tag/v0.2.0
[0.1.2]: https://github.com/quinnjr/ngx-tailwindcss/releases/tag/v0.1.2
[0.1.1]: https://github.com/quinnjr/ngx-tailwindcss/releases/tag/v0.1.1
[0.1.0]: https://github.com/quinnjr/ngx-tailwindcss/releases/tag/v0.1.0
[0.1.0-beta.1]: https://github.com/quinnjr/ngx-tailwindcss/releases/tag/v0.1.0-beta.1

