import { inject, Injectable } from '@angular/core';
import { DEFAULT_TW_CONFIG, TW_CONFIG, TwConfig } from './tw-config';

/**
 * Group patterns for common Tailwind utilities
 */
const GROUP_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  // Layout
  [
    /^(block|inline|inline-block|flex|inline-flex|grid|inline-grid|hidden|contents|flow-root|list-item|(inline-)?table|table-(caption|cell|column|column-group|footer-group|header-group|row-group|row))$/,
    'display',
  ],
  [/^(static|fixed|absolute|relative|sticky)$/, 'position'],
  // Inset: `inset-*` subsumes the axis and side utilities (`inset-shadow-*`/`inset-ring-*` are effects)
  [/^inset-x-/, 'inset-x'],
  [/^inset-y-/, 'inset-y'],
  [/^inset-(?!shadow|ring)/, 'inset'],
  [/^(top|right|bottom|left|start|end)-/, 'inset-$1'],
  [/^(visible|invisible|collapse)$/, 'visibility'],
  [/^overflow-x-/, 'overflow-x'],
  [/^overflow-y-/, 'overflow-y'],
  [/^overflow-/, 'overflow'],
  [/^z-/, 'z-index'],

  // Flexbox & Grid
  [/^flex-(row|col)(-reverse)?$/, 'flex-direction'],
  [/^flex-(wrap|nowrap|wrap-reverse)$/, 'flex-wrap'],
  [/^(?:flex-)?grow(-|$)/, 'flex-grow'],
  [/^(?:flex-)?shrink(-|$)/, 'flex-shrink'],
  [/^flex-/, 'flex'],
  [/^basis-/, 'flex-basis'],
  [/^justify-items-/, 'justify-items'],
  [/^justify-self-/, 'justify-self'],
  [/^justify-/, 'justify'],
  [/^items-/, 'items'],
  [/^self-/, 'self'],
  [/^content-/, 'content'],
  [/^place-content-/, 'place-content'],
  [/^place-items-/, 'place-items'],
  [/^place-self-/, 'place-self'],
  [/^gap-x-/, 'gap-x'],
  [/^gap-y-/, 'gap-y'],
  [/^gap-/, 'gap'],
  [/^grid-cols-/, 'grid-cols'],
  [/^col-start-/, 'col-start'],
  [/^col-end-/, 'col-end'],
  [/^col-/, 'col'],
  [/^grid-rows-/, 'grid-rows'],
  [/^row-start-/, 'row-start'],
  [/^row-end-/, 'row-end'],
  [/^row-/, 'row'],

  // Spacing - each direction is a separate group
  [/^px-/, 'padding-x'],
  [/^py-/, 'padding-y'],
  [/^pt-/, 'padding-top'],
  [/^pr-/, 'padding-right'],
  [/^pb-/, 'padding-bottom'],
  [/^pl-/, 'padding-left'],
  [/^ps-/, 'padding-start'],
  [/^pe-/, 'padding-end'],
  [/^p-/, 'padding'],
  [/^mx-/, 'margin-x'],
  [/^my-/, 'margin-y'],
  [/^mt-/, 'margin-top'],
  [/^mr-/, 'margin-right'],
  [/^mb-/, 'margin-bottom'],
  [/^ml-/, 'margin-left'],
  [/^ms-/, 'margin-start'],
  [/^me-/, 'margin-end'],
  [/^m-/, 'margin'],
  [/^space-x-/, 'space-x'],
  [/^space-y-/, 'space-y'],

  // Sizing
  [/^w-/, 'width'],
  [/^min-w-/, 'min-width'],
  [/^max-w-/, 'max-width'],
  [/^h-/, 'height'],
  [/^min-h-/, 'min-height'],
  [/^max-h-/, 'max-height'],
  [/^size-/, 'size'],

  // Typography
  [/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/, 'font-size'],
  [/^text-\[(?:length:|\d)/, 'font-size'],
  [/^text-(left|center|right|justify|start|end)$/, 'text-align'],
  [/^text-(wrap|nowrap|balance|pretty)$/, 'text-wrap'],
  [/^(truncate|text-ellipsis|text-clip)$/, 'text-overflow'],
  [/^text-/, 'text-color'],
  [/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, 'font-weight'],
  [/^font-/, 'font-family'],
  [/^leading-/, 'line-height'],
  [/^tracking-/, 'letter-spacing'],
  [/^(uppercase|lowercase|capitalize|normal-case)$/, 'text-transform'],
  [/^(underline|overline|line-through|no-underline)$/, 'text-decoration'],
  [/^whitespace-/, 'whitespace'],
  [/^break-(normal|words|all|keep)$/, 'word-break'],

  // Backgrounds
  [/^bg-(fixed|local|scroll)$/, 'bg-attachment'],
  [/^bg-clip-/, 'bg-clip'],
  [/^bg-origin-/, 'bg-origin'],
  [/^bg-blend-/, 'bg-blend'],
  [/^bg-(no-repeat|repeat(-x|-y|-round|-space)?)$/, 'bg-repeat'],
  [/^bg-((auto|cover|contain)$|size-)/, 'bg-size'],
  [/^bg-((bottom|center|left|right|top)(-|$)|position-)/, 'bg-position'],
  [/^bg-(none$|gradient-|linear-|radial|conic|\[url\()/, 'bg-image'],
  [/^bg-/, 'background'],
  [/^from-/, 'gradient-from'],
  [/^via-/, 'gradient-via'],
  [/^to-/, 'gradient-to'],

  // Borders
  // Border width/color per side are separate groups; the bare `border-*` and the
  // `-x`/`-y` axis utilities subsume their sides. Style is independent of width.
  [/^border-(solid|dashed|dotted|double|hidden|none)$/, 'border-style'],
  [/^border-([xytrblse])(?:$|-\d|-\[\d[^\]]*(?:px|rem|em)\]$)/, 'border-width-$1'],
  [/^border(?:$|-\d|-\[\d[^\]]*(?:px|rem|em)\]$)/, 'border-width'],
  [/^border-(collapse|separate)$/, 'border-collapse'],
  [/^border-spacing-/, 'border-spacing'],
  [/^border-([xytrblse])-/, 'border-color-$1'],
  [/^border-/, 'border-color'],
  // Corner/side radii are separate groups; the bare `rounded-*` shorthand subsumes them
  [/^rounded-(tl|tr|br|bl|ss|se|ee|es|t|r|b|l|s|e)(-|$)/, 'border-radius-$1'],
  [/^rounded(-|$)/, 'border-radius'],
  // Ring width, offset and color are distinct utilities that are used together
  // (e.g. `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500`)
  [/^ring(?:$|-\d+$|-\[\d[^\]]*(?:px|rem|em)\]$)/, 'ring-width'],
  [/^ring-inset$/, 'ring-inset'],
  [/^ring-offset-(?:\d+$|\[\d[^\]]*(?:px|rem|em)\]$)/, 'ring-offset-width'],
  [/^ring-offset-/, 'ring-offset-color'],
  [/^ring-/, 'ring-color'],

  // Effects
  // Shadow size (optionally with a v4 `/opacity` modifier) vs shadow color
  [/^shadow(-(2xs|xs|sm|md|lg|xl|2xl|inner|none)(\/\S+)?$|$|-\[\d)/, 'shadow'],
  [/^shadow-/, 'shadow-color'],
  [/^opacity-/, 'opacity'],
  [/^blur(-|$)/, 'blur'],

  // Transitions & Animation
  [/^transition(-|$)/, 'transition'],
  [/^duration-/, 'duration'],
  [/^ease-/, 'ease'],
  [/^delay-/, 'delay'],
  [/^animate-/, 'animate'],

  // Transforms
  [/^scale-x-/, 'scale-x'],
  [/^scale-y-/, 'scale-y'],
  [/^scale-/, 'scale'],
  [/^rotate-/, 'rotate'],
  [/^translate-x-/, 'translate-x'],
  [/^translate-y-/, 'translate-y'],
  [/^translate-/, 'translate'],
  [/^skew-/, 'skew'],
  [/^origin-/, 'transform-origin'],

  // Interactivity
  [/^cursor-/, 'cursor'],
  [/^pointer-events-/, 'pointer-events'],
  [/^select-/, 'user-select'],
  [/^resize(-|$)/, 'resize'],
  [/^scroll-(auto|smooth)$/, 'scroll-behavior'],
  [/^scroll-p[trblxye]?-/, 'scroll-padding'],
  [/^scroll-m[trblxye]?-/, 'scroll-margin'],
  [/^outline(-\d+$|-\[\d[^\]]*(px|rem|em)\]$|$)/, 'outline-width'],
  [/^outline-(none|hidden|solid|dashed|dotted|double)$/, 'outline-style'],
  [/^outline-offset-/, 'outline-offset'],
  [/^outline-/, 'outline-color'],
];

/**
 * Shorthand groups that subsume their longhand groups when applied later
 */
const SIDES = ['x', 'y', 't', 'r', 'b', 'l', 's', 'e'] as const;

const SHORTHAND_SUBSUMED_GROUPS: Record<string, readonly string[]> = {
  padding: [
    'padding-x',
    'padding-y',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'padding-start',
    'padding-end',
  ],
  'padding-x': ['padding-right', 'padding-left', 'padding-start', 'padding-end'],
  'padding-y': ['padding-top', 'padding-bottom'],
  margin: [
    'margin-x',
    'margin-y',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'margin-start',
    'margin-end',
  ],
  'margin-x': ['margin-right', 'margin-left', 'margin-start', 'margin-end'],
  'margin-y': ['margin-top', 'margin-bottom'],
  inset: [
    'inset-x',
    'inset-y',
    'inset-top',
    'inset-right',
    'inset-bottom',
    'inset-left',
    'inset-start',
    'inset-end',
  ],
  'inset-x': ['inset-right', 'inset-left', 'inset-start', 'inset-end'],
  'inset-y': ['inset-top', 'inset-bottom'],
  size: ['width', 'height'],
  'border-width': SIDES.map(side => `border-width-${side}`),
  'border-width-x': ['border-width-r', 'border-width-l', 'border-width-s', 'border-width-e'],
  'border-width-y': ['border-width-t', 'border-width-b'],
  'border-color': SIDES.map(side => `border-color-${side}`),
  'border-color-x': ['border-color-r', 'border-color-l', 'border-color-s', 'border-color-e'],
  'border-color-y': ['border-color-t', 'border-color-b'],
  gap: ['gap-x', 'gap-y'],
  overflow: ['overflow-x', 'overflow-y'],
  scale: ['scale-x', 'scale-y'],
  'border-radius': [
    'border-radius-t',
    'border-radius-r',
    'border-radius-b',
    'border-radius-l',
    'border-radius-s',
    'border-radius-e',
    'border-radius-tl',
    'border-radius-tr',
    'border-radius-br',
    'border-radius-bl',
    'border-radius-ss',
    'border-radius-se',
    'border-radius-ee',
    'border-radius-es',
  ],
  'border-radius-t': ['border-radius-tl', 'border-radius-tr'],
  'border-radius-r': ['border-radius-tr', 'border-radius-br'],
  'border-radius-b': ['border-radius-br', 'border-radius-bl'],
  'border-radius-l': ['border-radius-tl', 'border-radius-bl'],
  'border-radius-s': ['border-radius-ss', 'border-radius-es'],
  'border-radius-e': ['border-radius-se', 'border-radius-ee'],
  translate: ['translate-x', 'translate-y'],
};

/**
 * Variants whose position relative to other variants changes the generated
 * selector (pseudo-elements, child selectors). Other variants are sorted so
 * that e.g. `md:hover:p-2` and `hover:md:p-4` conflict, as in tailwind-merge.
 */
const ORDER_SENSITIVE_VARIANTS = new Set([
  '*',
  '**',
  'after',
  'backdrop',
  'before',
  'details-content',
  'file',
  'first-letter',
  'first-line',
  'marker',
  'placeholder',
  'selection',
]);

/**
 * Normalizes a variant list: arbitrary (`[...]`) and order-sensitive variants
 * stay in place, the runs of plain variants between them are sorted.
 */
function normalizeVariants(variants: string[]): string {
  const result: string[] = [];
  let run: string[] = [];

  for (const variant of variants) {
    if (variant.startsWith('[') || ORDER_SENSITIVE_VARIANTS.has(variant)) {
      result.push(...run.sort(), variant);
      run = [];
    } else {
      run.push(variant);
    }
  }
  result.push(...run.sort());

  return result.join(':');
}

/**
 * Memoized class -> group lookups
 */
const classGroupCache = new Map<string, string>();

/**
 * Splits a class into its variant parts on `:`, ignoring colons inside
 * arbitrary values like `bg-[url(https://example.com/img.png)]`
 */
function splitVariants(cls: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < cls.length; index++) {
    const char = cls[index];
    if (char === '[') depth++;
    else if (char === ']') depth = Math.max(0, depth - 1);
    else if (char === ':' && depth === 0) {
      parts.push(cls.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(cls.slice(start));

  return parts;
}

/**
 * Service for managing Tailwind CSS classes with conflict resolution
 * Uses a lightweight approach similar to tailwind-merge
 */
@Injectable({ providedIn: 'root' })
export class TwClassService {
  private readonly config: TwConfig;

  constructor() {
    const injectedConfig = inject(TW_CONFIG, { optional: true });
    // Deep-merge `theme` so a raw TW_CONFIG with a partial theme keeps the other variants
    this.config = {
      ...DEFAULT_TW_CONFIG,
      ...injectedConfig,
      theme: { ...DEFAULT_TW_CONFIG.theme, ...injectedConfig?.theme },
    };
  }

  /**
   * Merges multiple class strings, handling Tailwind class conflicts
   * Later classes override earlier ones for the same utility
   */
  merge(...classes: Array<string | undefined | null | false>): string {
    const classMap = new Map<string, string>();

    for (const classString of classes) {
      if (!classString) continue;

      const classList = classString.split(/\s+/).filter(Boolean);

      for (const cls of classList) {
        const group = this.getClassGroup(cls);

        // A shorthand (p-*/m-*) overrides any earlier longhands in the same variant
        const colonIndex = group.lastIndexOf(':');
        const groupPrefix = colonIndex === -1 ? '' : group.slice(0, colonIndex);
        const baseGroup = colonIndex === -1 ? group : group.slice(colonIndex + 1);
        const subsumed = SHORTHAND_SUBSUMED_GROUPS[baseGroup];
        if (subsumed) {
          for (const longhand of subsumed) {
            classMap.delete(groupPrefix ? `${groupPrefix}:${longhand}` : longhand);
          }
        }

        classMap.set(group, cls);
      }
    }

    return [...classMap.values()].join(' ');
  }

  /**
   * Conditionally applies classes based on a condition map
   */
  conditional(baseClasses: string, conditionals: Record<string, boolean | undefined>): string {
    const activeClasses = Object.entries(conditionals)
      .filter(([, condition]) => condition)
      .map(([classes]) => classes);

    return this.merge(baseClasses, ...activeClasses);
  }

  /**
   * Gets the variant classes for a given variant name
   */
  getVariantClasses(variant: string): string {
    return this.config.theme?.[variant as keyof typeof this.config.theme] ?? '';
  }

  /**
   * Determines the class group for conflict resolution
   */
  private getClassGroup(cls: string): string {
    const cached = classGroupCache.get(cls);
    if (cached !== undefined) return cached;

    // Handle responsive/state prefixes (ignoring colons inside arbitrary values)
    const parts = splitVariants(cls);
    let baseClass = parts.at(-1) ?? cls;
    const prefix = normalizeVariants(parts.slice(0, -1));

    // Strip important (leading `!` in v3, trailing `!` in v4) and negative (-)
    // markers for group matching
    while (baseClass.startsWith('!') || baseClass.startsWith('-')) {
      baseClass = baseClass.slice(1);
    }
    while (baseClass.endsWith('!')) {
      baseClass = baseClass.slice(0, -1);
    }

    let group = cls;
    for (const [pattern, groupName] of GROUP_PATTERNS) {
      const match = pattern.exec(baseClass);
      if (match) {
        const resolved = groupName.replace('$1', match[1] ?? '');
        group = prefix ? `${prefix}:${resolved}` : resolved;
        break;
      }
    }

    // The full class is its own group if no pattern matches
    classGroupCache.set(cls, group);
    return group;
  }

  /**
   * Creates a class string from an array of class names
   */
  join(...classes: Array<string | undefined | null | false>): string {
    return classes.filter(Boolean).join(' ');
  }
}
