/**
 * The values Angular accepts in a `[class]` binding: a class string, a list or set of
 * class names, or a map of class names to conditions.
 */
export type TwClassValue =
  | string
  | readonly string[]
  | ReadonlySet<string>
  | Readonly<Record<string, boolean | null | undefined>>
  | null
  | undefined;

/**
 * Normalizes a `[class]` binding value to a class string, so components that declare a
 * `class` input accept the same shapes as a plain element's `[class]` binding.
 * Use as the `transform` of a signal `class` input.
 */
export function twClassValue(value: TwClassValue): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value) || value instanceof Set) {
    return [...(value as Iterable<unknown>)].filter(Boolean).join(' ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, enabled]) => !!enabled)
      .map(([name]) => name)
      .join(' ');
  }
  return String(value);
}
