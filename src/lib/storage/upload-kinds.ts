/**
 * What the Media form accepts for each kind of upload, and where it goes.
 *
 * Shared by the upload box (the file chooser's filter) and the server action
 * that issues the upload (the check that counts). Safe in a Client Component:
 * plain values only.
 *
 * The content type is decided by the file's EXTENSION, not by what the browser
 * reports: browsers disagree (an .m4a is `audio/mp4`, `audio/x-m4a` or empty
 * depending on the system), and the type sent is the caller's to choose.
 * Storage refuses anything outside the bucket's own list as the backstop.
 */
export type UploadKind = "image" | "audio" | "document";

/** Who can open the file: decides the bucket (migration 0005, note 08 §26). */
export type UploadVisibility = "public" | "private";

export const UPLOAD_TYPES: Record<UploadKind, Record<string, string>> = {
  image: {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
    svg: "image/svg+xml",
  },
  audio: {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
  },
  document: {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

/** Matches the buckets' limit and the storage server's (config.toml). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function isUploadKind(value: string): value is UploadKind {
  return value in UPLOAD_TYPES;
}

/** The file chooser's filter: extensions and types both, for every browser. */
export function acceptFor(kind: UploadKind): string {
  const types = UPLOAD_TYPES[kind];
  return [...Object.keys(types).map((ext) => `.${ext}`), ...new Set(Object.values(types))].join(",");
}

/** The extensions as people know them, for the hint: "JPG, PNG, …". */
export function extensionsFor(kind: UploadKind): string {
  return Object.keys(UPLOAD_TYPES[kind])
    .filter((ext) => ext !== "jpeg")
    .map((ext) => ext.toUpperCase())
    .join(", ");
}

/**
 * Images are always public: they are shown on the site. Audio and documents
 * go where staff choose — public in `site-media` (an interview anyone can
 * play), private in `private-media` (for people with access, reached only
 * through a short-lived signed link). `course-assets` is for course material
 * only (owner, 2026-10-15), so a Media upload never goes there.
 */
export function bucketFor(kind: UploadKind, visibility: UploadVisibility): "site-media" | "private-media" {
  return kind === "image" || visibility === "public" ? "site-media" : "private-media";
}
