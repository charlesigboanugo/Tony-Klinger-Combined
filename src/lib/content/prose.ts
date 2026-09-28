/**
 * Plain-text article bodies → structured blocks — note 10 §42.
 *
 * The blog archive was imported as plain text from the predecessor site, and
 * it carries that site's habits, all of which have to read correctly:
 *
 *   - paragraphs separated by a blank line, which is often not empty but a
 *     line of stray spaces;
 *   - HARD-WRAPPED lines, where one sentence runs over a newline. Those lines
 *     end in a space (the editor kept the space it wrapped at), so a line that
 *     ends in whitespace continues on the next;
 *   - a paragraph break written as a single newline after a full sentence;
 *   - genuinely short lines — a list of names, a signature, a quoted email —
 *     which must stay as separate lines, not be run together.
 *
 * No markup is interpreted except a leading "## ", which makes a section
 * heading (the catalogue's convention, so an editor has one rule to learn).
 */

export type ProseBlock =
  | { kind: "heading"; text: string }
  /** One paragraph; each entry is a line, rendered with a break between. */
  | { kind: "paragraph"; lines: string[] };

/**
 * A line this long that ends a sentence is prose, and a newline after it is a
 * paragraph break. Shorter lines (list items, sign-offs) keep their break.
 */
const PROSE_LINE = 120;
const SENTENCE_END = /[.!?:"”’)]$/;

export function parseProse(text: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];

  for (const chunk of text.replace(/\r\n?/g, "\n").split(/\n[ \t ]*\n/)) {
    const raw = chunk.split("\n");
    let lines: string[] = [];
    // Whether the previous raw line ended in whitespace — a soft wrap.
    let softWrap = false;

    const flush = () => {
      if (lines.length) blocks.push({ kind: "paragraph", lines });
      lines = [];
    };

    for (const rawLine of raw) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith("## ")) {
        flush();
        blocks.push({ kind: "heading", text: line.slice(3).trim() });
        softWrap = false;
        continue;
      }

      const prev = lines.at(-1);
      if (prev === undefined) {
        lines.push(line);
      } else if (softWrap) {
        lines[lines.length - 1] = `${prev} ${line}`;
      } else if (prev.length >= PROSE_LINE && SENTENCE_END.test(prev)) {
        flush();
        lines.push(line);
      } else {
        lines.push(line);
      }

      softWrap = /[ \t ]$/.test(rawLine);
    }

    flush();
  }

  return blocks;
}

export type ProseSegment = { kind: "text"; text: string } | { kind: "link"; href: string };

/**
 * Bare URLs in a line, split out so they can be rendered as links. Trailing
 * punctuation belongs to the sentence, not the address.
 */
export function linkify(line: string): ProseSegment[] {
  const out: ProseSegment[] = [];
  const pattern = /https?:\/\/[^\s<>"”]+[^\s<>"”.,;:!?)’']/g;
  let last = 0;

  for (const match of line.matchAll(pattern)) {
    const at = match.index;
    if (at > last) out.push({ kind: "text", text: line.slice(last, at) });
    out.push({ kind: "link", href: match[0] });
    last = at + match[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });

  return out;
}
