/**
 * Lesson bodies → structured blocks — note 07 §34.
 *
 * The curriculum migrated from the previous CMS is MARKDOWN, not the blog
 * archive's plain text: `###` section headings, `**bold**` and `*italic*`
 * runs, numbered and bulleted lists. The lesson page used to split on blank
 * lines and print each chunk as a paragraph, so learners read literal `###`
 * and `**` markers through every lesson.
 *
 * Only the subset the content actually uses is recognised. Anything else
 * reads as plain text — which is what it was before, so nothing an editor
 * writes can make a lesson worse than unformatted.
 *
 * No HTML is produced here. The page renders these blocks as React elements,
 * so a stray `<script>` in a lesson is text, never markup.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] };

export type LessonBlock =
  | { kind: "heading"; level: 2 | 3; text: Inline[] }
  | { kind: "paragraph"; text: Inline[] }
  | { kind: "list"; ordered: boolean; start: number; items: Inline[][] }
  | { kind: "quote"; text: Inline[] }
  | { kind: "video"; provider: string; id: string };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*$/;
const BULLET = /^[-*+]\s+(.*)$/;
const NUMBERED = /^(\d{1,3})[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
/** The old CMS's embed directive, e.g. `:Youtube{videoID="…"}` — a second
 *  video placed inside the text. Printed literally before; now a block the
 *  page renders through the same server-only video module as the main player. */
const DIRECTIVE = /^:([A-Za-z]+)\{\s*video[Ii][Dd]\s*=\s*"([^"]+)"\s*\}$/;

export function parseLesson(source: string): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");

  let paragraph: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: parseInline(paragraph.join(" ")) });
    }
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      blocks.push({
        kind: "list",
        ordered: list.ordered,
        start: list.start,
        items: list.items.map(parseInline),
      });
    }
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushParagraph();
      // A blank line between items does not end a list — the migrated content
      // spaces its numbered points apart. The next non-item line will.
      continue;
    }

    const directive = DIRECTIVE.exec(line);
    if (directive) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "video", provider: directive[1].toLowerCase(), id: directive[2] });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      // h1 in a lesson body would compete with the lesson title, and h4–h6 are
      // finer than a lesson needs: everything folds to the two levels shown.
      const level = heading[1].length <= 2 ? 2 : 3;
      blocks.push({ kind: "heading", level, text: parseInline(heading[2]) });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, start: numbered ? Number(numbered[1]) : 1, items: [] };
      }
      list.items.push(bullet ? bullet[1] : numbered![2]);
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "quote", text: parseInline(quote[1]) });
      continue;
    }

    // An unmarked line straight after a list item continues that item (a
    // wrapped line); after a blank line it starts a paragraph.
    if (list && paragraph.length === 0 && lines[i - 1]?.trim()) {
      list.items[list.items.length - 1] += ` ${line}`;
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

/**
 * `**strong**`, `*em*` / `_em_`, and `[text](https://…)`. Only http(s) and
 * site-relative links become links; anything else stays as its literal text.
 */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern =
    /\*\*(.+?)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])|(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g;

  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ kind: "text", text: text.slice(last, index) });

    if (match[1] !== undefined) {
      out.push({ kind: "strong", children: parseInline(match[1]) });
    } else if (match[2] !== undefined) {
      out.push({ kind: "link", href: match[3], children: parseInline(match[2]) });
    } else {
      out.push({ kind: "em", children: parseInline(match[4] ?? match[5]) });
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Plain text of a lesson body, for a reading-time estimate. */
export function lessonWordCount(source: string): number {
  return source.replace(/[#*_>[\]()-]/g, " ").split(/\s+/).filter(Boolean).length;
}
