"use client";

import { useRef, useState } from "react";

import { prepareMediaUploadAction } from "@/app/admin/actions";
import { Toggle } from "@/components/admin/AdminForm";
import { Button } from "@/components/ui/Button";
import { publicStorageUrl } from "@/lib/storage/public-url";
import {
  acceptFor,
  extensionsFor,
  isUploadKind,
  MAX_UPLOAD_BYTES,
  type UploadKind,
} from "@/lib/storage/upload-kinds";
import { createClient } from "@/lib/supabase/client";

/**
 * Upload a file to Media (owner, 2026-10-15), in place of typing its storage
 * path by hand.
 *
 * What it accepts follows the item's TYPE: an image, an audio file or a
 * document, each with its own file filter. An image always goes in the public
 * bucket; for audio and documents staff choose whether anyone can open it,
 * and changing that on a saved file moves it when the form is saved
 * (`src/lib/storage/visibility.ts`), so nothing has to be uploaded again.
 *
 * The file is sent from the browser straight to storage with a one-time link
 * the server issues after checking permission (`prepareMediaUploadAction`),
 * because a recording is far larger than a request through the server can
 * carry. The form then saves the stored path, and for an image its size in
 * pixels, which the site uses to lay the image out at its true shape.
 */
type State =
  | { phase: "idle" }
  | { phase: "uploading"; name: string }
  | { phase: "done"; name: string }
  | { phase: "error"; message: string };

export function MediaUpload({
  name,
  kind,
  defaultValue,
  disabled = false,
}: {
  /** The column the stored path is saved to. */
  name: string;
  /** The item's type, as chosen on the form. */
  kind: string;
  /** The path already stored, when editing. */
  defaultValue: string | null;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(defaultValue ?? "");
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // Starts at where the stored file is, so editing shows the truth.
  const [isPublic, setIsPublic] = useState(Boolean(defaultValue?.startsWith("site-media/")));
  const [state, setState] = useState<State>({ phase: "idle" });

  if (!isUploadKind(kind)) {
    return <p className="text-sm text-muted-foreground">Choose the type above first.</p>;
  }

  async function upload(file: File, uploadKind: UploadKind) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setState({ phase: "error", message: "The file must be 50 MB or smaller." });
      return;
    }
    setState({ phase: "uploading", name: file.name });

    const ticket = await prepareMediaUploadAction({
      kind: uploadKind,
      visibility: isPublic ? "public" : "private",
      filename: file.name,
      size: file.size,
    });
    if (!ticket.ok) {
      setState({ phase: "error", message: ticket.error });
      return;
    }

    const { error } = await createClient()
      .storage.from(ticket.bucket)
      .uploadToSignedUrl(ticket.path, ticket.token, file);
    if (error) {
      setState({ phase: "error", message: `The upload failed: ${error.message}` });
      return;
    }

    setSize(uploadKind === "image" ? await pixelSize(file) : null);
    setPath(`${ticket.bucket}/${ticket.path}`);
    setState({ phase: "done", name: file.name });
  }

  const busy = state.phase === "uploading";
  const preview = kind === "image" && path.startsWith("site-media/") ? publicStorageUrl(path) : null;
  const where = path.startsWith("site-media/") ? "Public" : path ? "Private" : null;
  // The switch decides where the next upload goes, and a file already here
  // moves to match when the form is saved. Said plainly when the two differ.
  const mismatch = kind !== "image" && where !== null && (where === "Public") !== isPublic;

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={path} />
      {size ? (
        <>
          <input type="hidden" name="width" value={size.width} />
          <input type="hidden" name="height" value={size.height} />
        </>
      ) : null}

      {kind === "image" ? null : (
        <input type="hidden" name="__visibility" value={isPublic ? "public" : "private"} />
      )}
      {kind === "image" ? null : (
        <Toggle
          label="Anyone can open it"
          hint="On: public, like an interview anyone can play. Off: only people with access to what it is attached to, through a short-lived link. You can change it at any time; the file moves when you save."
          checked={isPublic}
          disabled={disabled || busy}
          onChange={(event) => setIsPublic(event.target.checked)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept={acceptFor(kind)}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file, kind);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          {busy ? "Uploading…" : path ? "Replace file" : "Choose file"}
        </Button>
        <span className="text-xs text-muted-foreground">{extensionsFor(kind)}, up to 50 MB</span>
      </div>

      {mismatch ? (
        <p className="text-sm font-medium text-warning" aria-live="polite">
          This file is {where?.toLowerCase()} now. Saving makes it {isPublic ? "public" : "private"}.
        </p>
      ) : null}

      {state.phase === "error" ? (
        <p role="alert" className="text-sm text-error">
          {state.message}
        </p>
      ) : null}

      {path ? (
        <div className="flex items-center gap-3 rounded-(--radius) border border-border px-3 py-2 text-sm" aria-live="polite">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- an admin preview of a just-uploaded file, not a site image
            <img src={preview} alt="" className="size-12 shrink-0 rounded object-cover" />
          ) : null}
          <span className="min-w-0 flex-1 truncate">
            {state.phase === "done" ? `Uploaded: ${state.name}` : path.slice(path.indexOf("/") + 1)}
          </span>
          {where ? <span className="shrink-0 text-xs text-muted-foreground">{where}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** An image's size in pixels, read in the browser; null if it cannot be read (SVG). */
async function pixelSize(file: File): Promise<{ width: number; height: number } | null> {
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}
