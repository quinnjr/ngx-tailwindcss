/**
 * Split a shortcut string such as `ctrl+shift+p` into its parts.
 *
 * A `+` separates parts, except where a part would otherwise be empty: there
 * it is the plus key itself, so `ctrl++` yields `['ctrl', '+']` and `+` yields
 * `['+']`. Whitespace around parts is ignored (`ctrl + +` works too), and
 * `plus` remains an alias for the plus key in the parsers.
 */
export function splitShortcut(shortcut: string): string[] {
  const parts: string[] = [];
  let current = '';

  for (const char of shortcut) {
    if (char === '+' && current.trim() !== '') {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  const last = current.trim();
  if (last !== '') parts.push(last);
  return parts;
}
