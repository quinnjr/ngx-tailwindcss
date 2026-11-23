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
- Native services, music components and audio services: many correctness and
  resource-cleanup fixes
- Documentation: corrected package name and documented APIs; demo labels,
  headings and inline code on the docs site are readable in dark mode

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

