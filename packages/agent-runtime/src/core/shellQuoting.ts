/**
 * Shell word quoting helpers shared by the command splitter.
 *
 * Kept separate from `shellCommand.ts` (already over the repository's
 * 1200-line source limit): quote removal is a self-contained stage — it takes
 * raw text and returns the word the shell would present as argv — and it is
 * where the ANSI-C semantics (`$'…'`, NUL truncation) live.
 */

/**
 * Grouping operators (`(`, `)`) are shell syntax, never part of a word, but
 * the tokenizer only splits on command separators — so an operand can arrive
 * as `~)` and a command word as `(command`. Hand-scanned instead of
 * `replace(/^\(+/, '').replace(/\)+$/, '')`: operands come straight from the
 * tool call, and a regex over uncontrolled input is a CodeQL
 * js/polynomial-redos finding; index walks are linear.
 */
export const trimGroupingRuns = (word: string, trimTrailing: boolean): string => {
  let start = 0;
  let end = word.length;
  while (start < end && word[start] === '(') start++;
  while (trimTrailing && end > start && word[end - 1] === ')') end--;
  return word.slice(start, end);
};

/** Strip operator runs from both edges (`~)` → `~`, `(rm` → `rm`). */
export const stripGroupingParens = (word: string): string => trimGroupingRuns(word, true);

/** Strip only a leading opener: function definitions (`f()`) and `case` arms
 * (`a)`) keep their trailing `)` as syntax. */
export const stripLeadingGroupingParens = (word: string): string => trimGroupingRuns(word, false);

const ANSI_C_SIMPLE_ESCAPES: Record<string, string> = {
  '"': '"',
  "'": "'",
  '?': '?',
  '\\': '\\',
  'E': '\x1B',
  'a': '\x07',
  'b': '\b',
  'e': '\x1B',
  'f': '\f',
  'n': '\n',
  'r': '\r',
  't': '\t',
  'v': '\v',
};

/**
 * Decode an ANSI-C quoted payload starting just after `$'`. Returns the
 * decoded text and the index just past the closing quote (or the end of
 * input when unterminated).
 */
export const decodeAnsiCQuoted = (raw: string, start: number): { end: number; value: string } => {
  let value = '';
  let i = start;
  // Bash stores ANSI-C strings as C strings: a decoded NUL terminates the
  // value, and everything after it is dropped even though the closing quote is
  // still honoured (`$'EOF\0ignored'` is the word `EOF`). Appending the tail
  // made the heredoc delimiter `EOF\0ignored`, so the real terminator line
  // never matched and the `rm -rf ~` after the heredoc was read as stdin data.
  let truncated = false;
  const append = (text: string): void => {
    if (truncated) return;
    const nul = text.indexOf('\0');
    if (nul === -1) {
      value += text;
      return;
    }
    value += text.slice(0, nul);
    truncated = true;
  };
  const readDigits = (pattern: RegExp, max: number): string => {
    let digits = '';
    while (digits.length < max && i < raw.length && pattern.test(raw[i])) digits += raw[i++];
    return digits;
  };
  while (i < raw.length) {
    const char = raw[i];
    if (char === "'") return { end: i + 1, value };
    if (char !== '\\' || i + 1 >= raw.length) {
      append(char);
      i++;
      continue;
    }
    const next = raw[i + 1];
    i += 2;
    if (next in ANSI_C_SIMPLE_ESCAPES) {
      append(ANSI_C_SIMPLE_ESCAPES[next]);
    } else if (next === 'x') {
      const hex = readDigits(/[\da-f]/i, 2);
      append(hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : '\\x');
    } else if (next === 'u' || next === 'U') {
      const hex = readDigits(/[\da-f]/i, next === 'u' ? 4 : 8);
      const codePoint = hex ? Number.parseInt(hex, 16) : Number.NaN;
      append(codePoint <= 0x10_ffff ? String.fromCodePoint(codePoint) : `\\${next}${hex}`);
    } else if (/[0-7]/.test(next)) {
      i--;
      const octal = readDigits(/[0-7]/, 3);
      append(String.fromCodePoint(Number.parseInt(octal, 8) & 0xff));
    } else if (next === 'c' && i < raw.length) {
      append(String.fromCodePoint(raw[i++].toUpperCase().charCodeAt(0) ^ 0x40));
    } else {
      // Unknown escape: bash keeps the backslash.
      append(`\\${next}`);
    }
  }
  return { end: i, value };
};
