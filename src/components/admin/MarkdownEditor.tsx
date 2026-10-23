"use client";

import { useId, useRef, useState, type ReactNode } from "react";

import { LessonBlocks } from "@/components/academy/LessonBlocks";
import { parseLesson } from "@/lib/academy/lesson-markdown";
import { cn } from "@/lib/utils/cn";

/**
 * The lesson text box in admin (owner, 2026-10-15).
 *
 * The text is still stored as Markdown — safe, portable, and what the lesson
 * page already reads — but nobody has to remember its codes: the toolbar
 * writes them (bold, italic, headings, lists, a quote, a link, a video inside
 * the text), and Preview shows the lesson as the page will, laid out by the
 * same `LessonBlocks` the page uses. A video in the preview is a labelled
 * placeholder: the real player is only ever built on the server.
 *
 * Edits go through the browser's own text insertion where it is available,
 * so Ctrl/Cmd+Z undoes a toolbar action like any typing.
 */
type Mode = "write" | "preview" | "both";
type Action = "bold" | "italic" | "h2" | "h3" | "bullets" | "numbers" | "quote" | "link";

const PROVIDERS = [
  { value: "youtube", label: "YouTube", directive: "Youtube" },
  { value: "vimeo", label: "Vimeo", directive: "Vimeo" },
  { value: "livid", label: "Livid", directive: "Livid" },
] as const;

/** An id from a pasted address, or the text as typed when it is already an id. */
function videoId(provider: string, input: string): string {
  const text = input.trim();
  if (provider === "youtube") {
    const match = text.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return match ? match[1] : text;
  }
  if (provider === "vimeo") {
    const match = text.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? match[1] : text;
  }
  return text;
}

export function MarkdownEditor({
  id,
  name,
  defaultValue,
  required,
  disabled,
  describedBy,
}: {
  id: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  disabled?: boolean;
  describedBy?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<Mode>("write");
  const [videoOpen, setVideoOpen] = useState(false);
  const [provider, setProvider] = useState<string>("youtube");
  const [videoInput, setVideoInput] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const videoInputId = useId();

  /** Replace the selection, keeping it undoable, then select `[from, to)` of what was inserted. */
  function insert(text: string, selectFrom = text.length, selectTo = selectFrom) {
    const el = area.current;
    if (!el) return;
    el.focus();
    const start = el.selectionStart;
    // `insertText` joins the browser's undo history; the fallback does not,
    // but still edits the text and tells React about it.
    const done = typeof document.execCommand === "function" && document.execCommand("insertText", false, text);
    if (!done) {
      el.setRangeText(text, el.selectionStart, el.selectionEnd, "end");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setValue(el.value);
    el.setSelectionRange(start + selectFrom, start + selectTo);
  }

  /** Wrap the selection, e.g. in `**`; with nothing selected, a placeholder to type over. */
  function wrap(before: string, after: string, placeholder: string) {
    const el = area.current;
    if (!el) return;
    const selected = el.value.slice(el.selectionStart, el.selectionEnd) || placeholder;
    insert(`${before}${selected}${after}`, before.length, before.length + selected.length);
  }

  /** Put `prefix` at the start of every line the selection touches. */
  function prefixLines(prefix: (index: number) => string) {
    const el = area.current;
    if (!el) return;
    const start = el.value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const endBreak = el.value.indexOf("\n", el.selectionEnd);
    const end = endBreak === -1 ? el.value.length : endBreak;
    el.setSelectionRange(start, end);
    const lines = el.value.slice(start, end).split("\n");
    const text = lines.map((line, i) => `${prefix(i)}${line.replace(/^(#{1,6}\s+|[-*+]\s+|\d{1,3}[.)]\s+|>\s?)/, "")}`).join("\n");
    insert(text, text.length);
  }

  /** A block of its own: blank lines around it, so it never joins a paragraph. */
  function insertBlock(text: string) {
    const el = area.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const after = el.value.slice(el.selectionEnd);
    const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const tail = after === "" || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
    insert(`${lead}${text}${tail}`, lead.length + text.length);
  }

  function addVideo() {
    const idValue = videoId(provider, videoInput);
    if (!idValue) return;
    const directive = PROVIDERS.find((p) => p.value === provider)?.directive ?? "Youtube";
    insertBlock(`:${directive}{videoID="${idValue.replace(/"/g, "")}"}`);
    setVideoInput("");
    setVideoOpen(false);
  }

  /** What each toolbar button does, run only from a click or a shortcut. */
  function act(action: Action) {
    const el = area.current;
    switch (action) {
      case "bold":
        return wrap("**", "**", "bold text");
      case "italic":
        return wrap("*", "*", "italic text");
      case "h2":
        return prefixLines(() => "## ");
      case "h3":
        return prefixLines(() => "### ");
      case "bullets":
        return prefixLines(() => "- ");
      case "numbers":
        return prefixLines((i) => `${i + 1}. `);
      case "quote":
        return prefixLines(() => "> ");
      case "link": {
        if (!el) return;
        const selected = el.value.slice(el.selectionStart, el.selectionEnd) || "link text";
        const text = `[${selected}](https://)`;
        // Select the address part, ready to paste over.
        return insert(text, selected.length + 3, text.length - 1);
      }
    }
  }

  const tools: Array<{ label: string; title: string; action: Action; icon: ReactNode }> = [
    { label: "Bold", title: "Bold (Ctrl+B)", action: "bold", icon: <b className="font-bold">B</b> },
    { label: "Italic", title: "Italic (Ctrl+I)", action: "italic", icon: <i className="font-serif">I</i> },
    { label: "Heading", title: "Heading", action: "h2", icon: <span className="text-xs font-bold">H2</span> },
    { label: "Subheading", title: "Smaller heading", action: "h3", icon: <span className="text-xs font-bold">H3</span> },
    {
      label: "Bullet list",
      title: "Bullet list",
      action: "bullets",
      icon: (
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <circle cx="2.5" cy="4" r=".9" fill="currentColor" /><circle cx="2.5" cy="8" r=".9" fill="currentColor" /><circle cx="2.5" cy="12" r=".9" fill="currentColor" />
          <path d="M6 4h8M6 8h8M6 12h8" />
        </svg>
      ),
    },
    {
      label: "Numbered list",
      title: "Numbered list",
      action: "numbers",
      icon: (
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M6 4h8M6 8h8M6 12h8" />
          <text x="0.5" y="5.5" fontSize="5" fill="currentColor" stroke="none">1</text>
          <text x="0.5" y="13.5" fontSize="5" fill="currentColor" stroke="none">2</text>
        </svg>
      ),
    },
    {
      label: "Quote",
      title: "Quote",
      action: "quote",
      icon: <span className="font-serif text-lg leading-none">&ldquo;</span>,
    },
    {
      label: "Link",
      title: "Link (Ctrl+K)",
      action: "link",
      icon: (
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.6.6M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.6-.6" />
        </svg>
      ),
    },
  ];

  const tab = (value: Mode, label: string, extra?: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={cn(
        "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
        mode === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
        extra,
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-(--radius) border border-input-border bg-background focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-muted/60 px-2 py-1.5">
        <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
          {tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              title={tool.title}
              aria-label={tool.label}
              disabled={disabled || mode === "preview"}
              onClick={() => act(tool.action)}
              className="grid size-8 cursor-pointer place-items-center rounded-md text-foreground/80 transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {tool.icon}
            </button>
          ))}
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
          <button
            type="button"
            disabled={disabled || mode === "preview"}
            onClick={() => setVideoOpen((v) => !v)}
            aria-expanded={videoOpen}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M5 3.5v9l7.5-4.5z" />
            </svg>
            Insert video
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-background p-0.5">
          {tab("write", "Write")}
          {tab("preview", "Preview")}
          {tab("both", "Side by side", "hidden lg:inline-block")}
        </div>
      </div>

      {/* Kept mounted so it animates out as well as in (the shared motion). */}
      <div data-open={videoOpen} className="dropdown-panel dropdown-inline origin-top">
        <div className="flex flex-wrap items-end gap-2 border-b border-border bg-surface px-3 py-3">
          <label className="text-xs font-medium">
            <span className="mb-1 block text-muted-foreground">Host</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="h-9 rounded-(--radius) border border-input-border bg-background px-2 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={videoInputId} className="min-w-48 flex-1 text-xs font-medium">
            <span className="mb-1 block text-muted-foreground">Video link or id</span>
            <input
              id={videoInputId}
              value={videoInput}
              onChange={(event) => setVideoInput(event.target.value)}
              onKeyDown={(event) => {
                // Enter adds the video; it must not submit the lesson form.
                if (event.key === "Enter") {
                  event.preventDefault();
                  addVideo();
                }
              }}
              placeholder="https://www.youtube.com/watch?v=…"
              className="h-9 w-full rounded-(--radius) border border-input-border bg-background px-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={addVideo}
            disabled={!videoInput.trim()}
            className="h-9 cursor-pointer rounded-full bg-button px-4 text-sm font-semibold text-button-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className={cn(mode === "both" && "lg:grid lg:grid-cols-2 lg:divide-x lg:divide-border")}>
        {/* The textarea stays mounted in Preview (hidden), so its value is
            always the one the form submits. */}
        <textarea
          ref={area}
          id={id}
          name={name}
          rows={18}
          value={value}
          required={required}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (!(event.metaKey || event.ctrlKey)) return;
            const key = event.key.toLowerCase();
            const shortcut: Record<string, Action> = { b: "bold", i: "italic", k: "link" };
            if (shortcut[key]) {
              event.preventDefault();
              act(shortcut[key]);
            }
          }}
          className={cn(
            "block w-full resize-y bg-transparent px-3 py-3 font-mono text-sm leading-relaxed outline-none",
            mode === "preview" && "hidden",
          )}
        />
        {mode !== "write" ? (
          <div className="max-h-[38rem] min-h-[18rem] overflow-y-auto px-4 py-4">
            {value.trim() ? (
              <LessonBlocks
                blocks={parseLesson(value)}
                renderVideo={(block) => (
                  <div className="grid aspect-video place-items-center rounded-(--radius-lg) border border-dashed border-border bg-surface-muted text-center text-sm text-muted-foreground">
                    <span>
                      <span aria-hidden="true" className="mb-1 block text-2xl">&#9654;</span>
                      {block.provider === "youtube" ? "YouTube" : block.provider === "vimeo" ? "Vimeo" : "Livid"} video ·{" "}
                      <span className="font-mono">{block.id}</span>
                      <span className="mt-1 block text-xs">Plays here on the lesson page</span>
                    </span>
                  </div>
                )}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing written yet.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
