"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { saveResourceAction, type AdminFormState } from "@/app/admin/actions";
import { AdminCard, FormFooter, FormGrid, Toggle } from "@/components/admin/AdminForm";
import { StatusPill } from "@/components/admin/AdminTable";
import { MediaPicker, type MediaOption } from "@/components/admin/MediaPicker";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { codeLabel } from "@/lib/admin/labels";
import type { Field, ResourceConfig } from "@/lib/admin/resources";

/**
 * Generated create/edit form — note 06 §14, note 10 §23.
 *
 * Rendered from the resource's field declarations, so every admin area gets the
 * same validation, the same layout and the same error handling. Adding a column
 * is one line in `resources.ts` rather than edits across a page, a form and
 * three actions.
 *
 * LAYOUT (note 10 §32.1). One card, fields on a two-column grid so a form of
 * a dozen fields is not a single tall column down the left edge. The first
 * field (the name) and anything long (text areas, the image picker, tags) take
 * the full width; the rest pair up. Save sits in the card's footer bar.
 *
 * Errors from the database are shown VERBATIM. This is a staff-only surface,
 * and "duplicate key value violates unique constraint products_slug_key" tells
 * an operator exactly what to change, where "Something went wrong" leaves them
 * guessing. Customer-facing errors are deliberately the opposite (note 05 §35).
 */
export function ResourceForm({
  resource,
  row,
  media = [],
  references = {},
  emails = {},
  finished = false,
  from,
}: {
  resource: ResourceConfig;
  row?: Record<string, unknown> | null;
  /** The image library, passed in only when this resource has a media field. */
  media?: MediaOption[];
  /** Options for each `reference` field, keyed by field name. */
  references?: Record<string, Array<{ id: string; label: string }>>;
  /** Account id to email, for fields that hold an account: shown as the email. */
  emails?: Record<string, string>;
  /** The row has finished: only `resource.past.stillEditable` can change. */
  finished?: boolean;
  /** The list this was opened from, returned to after saving (`back.ts`). */
  from?: string;
}) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    saveResourceAction,
    {},
  );

  const id = row?.id ? String(row.id) : undefined;

  // The current value of each field another field depends on (`shownFor`),
  // e.g. a product's type, so the form shows only what that choice needs.
  const [watched, setWatched] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...new Set(resource.fields.flatMap((f) => (f.shownFor ? [f.shownFor.field] : [])))].map((name) => [
        name,
        String(row?.[name] ?? ""),
      ]),
    ),
  );

  return (
    <form action={formAction} className="max-w-4xl">
      <input type="hidden" name="__resource" value={resource.slug} />
      {id ? <input type="hidden" name="__id" value={id} /> : null}
      {from ? <input type="hidden" name="__from" value={from} /> : null}

      <AdminCard
        footer={
          <FormFooter
            note={finished ? undefined : resource.fields.some((f) => f.required) ? "Fields marked * are required." : undefined}
          >
            <Link
              href={`/admin/${resource.slug}`}
              className="rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {finished && !(resource.past?.stillEditable?.length) ? "Back to the list" : "Cancel"}
            </Link>
            {finished && !(resource.past?.stillEditable?.length) ? null : (
              <SubmitButton>{id ? "Save changes" : `Create ${resource.labelSingular.toLowerCase()}`}</SubmitButton>
            )}
          </FormFooter>
        }
      >
        <FormGrid>
          {state.error ? (
            <p
              role="alert"
              className="rounded-(--radius) border border-error bg-error/10 px-3 py-2 text-sm text-error sm:col-span-2"
            >
              {state.error}
            </p>
          ) : null}

          {resource.fields
            // A read-only field is set by the system — the Stripe product id, for
            // instance. Shown when editing so an operator can see it, never
            // offered as an input.
            .filter((field) => !field.hidden)
            .filter((field) => !field.readOnly || id)
            .filter((field) => !field.shownFor || field.shownFor.values.includes(watched[field.shownFor.field] ?? ""))
            .map((field, index) => (
              <FormField
                key={field.name}
                field={field}
                // An account is shown, and typed, as its email; the save turns
                // an email back into the account (`resolveCustomers`).
                value={emails[String(row?.[field.name] ?? "")] ?? row?.[field.name]}
                media={media}
                references={references}
                uploadKind={field.uploadKind ? (watched[field.uploadKind] ?? String(row?.[field.uploadKind] ?? "")) : ""}
                editing={Boolean(id)}
                frozen={finished && !(resource.past?.stillEditable ?? []).includes(field.name)}
                onChange={
                  field.name in watched ? (next) => setWatched((w) => ({ ...w, [field.name]: next })) : undefined
                }
                wide={index === 0 || field.type === "textarea" || field.type === "media" || field.type === "upload" || field.type === "tags"}
              />
            ))}
        </FormGrid>
      </AdminCard>
    </form>
  );
}

function FormField({
  field,
  value,
  media,
  references,
  uploadKind,
  wide,
  editing,
  frozen,
  onChange,
}: {
  field: Field;
  /** For an upload field: the kind of file the form currently asks for. */
  uploadKind: string;
  /** Told the new value, for a field others are shown or hidden by. */
  onChange?: (value: string) => void;
  /** Shown but not editable, because the row has finished. */
  frozen: boolean;
  /** An existing row, not a new one. */
  editing: boolean;
  /** Takes both columns of the grid. */
  wide: boolean;
  value: unknown;
  media: MediaOption[];
  references: Record<string, Array<{ id: string; label: string }>>;
}) {
  const id = `field-${field.name}`;
  // Locked when editing: set by the system, or fixed once the row exists.
  const locked = editing && field.fixedOnceCreated;
  const disabled = field.readOnly || locked || frozen;
  // A locked field says so, so a greyed-out box is not mistaken for a fault.
  // A slug left empty is made from the name (`fillSlugs` in crud.ts), so the
  // form says so rather than looking like a field that was forgotten.
  const fieldHint =
    field.type === "slug" && !editing
      ? `${field.hint ?? ""} Leave empty to make one from the name.`.trim()
      : field.hint;
  const hint = locked && !field.readOnly ? `Fixed once created. ${fieldHint ?? ""}`.trim() : fieldHint;
  const described = hint ? `${id}-hint` : undefined;

  const base =
    "w-full rounded-(--radius) border border-input-border bg-background px-3 text-base " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
    "disabled:opacity-60";

  // Datetime inputs need `YYYY-MM-DDTHH:mm`; a stored ISO string has seconds and
  // a zone, which the input silently rejects and renders as blank.
  const asInputValue = () => {
    if (value === null || value === undefined) return "";
    if (field.type === "datetime") return String(value).slice(0, 16);
    if (field.type === "date") return String(value).slice(0, 10);
    if (field.type === "tags") return Array.isArray(value) ? value.join(", ") : "";
    return String(value);
  };

  return (
    <div className={wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      {/* A switch carries its own name, so it gets no label above it. */}
      {field.type === "boolean" ? null : (
        <label htmlFor={id} className="block text-sm font-medium">
          {field.label}
          {field.required ? <span className="ml-1 text-error">*</span> : null}
        </label>
      )}

      {frozen && field.name === "status" ? (
        // A finished row's status is not the one it was published with: it is
        // over. Shown, quietly, in place of the locked choice.
        <div className="flex h-11 items-center">
          <StatusPill value={String(value) === "cancelled" ? "cancelled" : "completed"} />
        </div>
      ) : field.type === "reference" ? (
        <Select
          id={id}
          name={field.name}
          required={field.required}
          disabled={disabled}
          defaultValue={asInputValue()}
          aria-describedby={described}
        >
          <option value="">Choose…</option>
          {(references[field.name] ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : field.type === "media" ? (
        <MediaPicker
          name={field.name}
          // Only what this field takes: images for a cover, recordings for a replay.
          options={media.filter((option) => (field.mediaKinds ?? ["image"]).includes(option.kind))}
          kinds={field.mediaKinds ?? ["image"]}
          noun={field.mediaKinds ? field.label.toLowerCase() : "image"}
          defaultValue={value ? String(value) : null}
          disabled={disabled}
        />
      ) : field.type === "upload" ? (
        // Keyed by kind, so changing the type clears a file chosen for the old one.
        <MediaUpload
          key={uploadKind}
          name={field.name}
          kind={uploadKind}
          defaultValue={value ? String(value) : null}
          disabled={disabled}
        />
      ) : field.type === "textarea" && field.markdown ? (
        <MarkdownEditor
          id={id}
          name={field.name}
          defaultValue={asInputValue()}
          required={field.required}
          disabled={disabled}
          describedBy={described}
        />
      ) : field.type === "textarea" ? (
        <textarea
          id={id}
          name={field.name}
          rows={6}
          required={field.required}
          disabled={disabled}
          defaultValue={asInputValue()}
          aria-describedby={described}
          className={`${base} py-2`}
        />
      ) : field.type === "select" ? (
        <Select
          id={id}
          name={field.name}
          required={field.required}
          disabled={disabled}
          defaultValue={asInputValue()}
          aria-describedby={described}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        >
          <option value="">Choose…</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {codeLabel(option)}
            </option>
          ))}
        </Select>
      ) : field.type === "boolean" ? (
        <Toggle
          id={id}
          name={field.name}
          label={field.label}
          hint={field.hint}
          disabled={disabled}
          defaultChecked={value === true}
        />
      ) : (
        <input
          id={id}
          name={field.name}
          type={
            field.type === "number" || field.type === "money"
              ? "number"
              : field.type === "date"
                ? "date"
                : field.type === "datetime"
                  ? "datetime-local"
                  : "text"
          }
          required={field.required}
          disabled={disabled}
          defaultValue={asInputValue()}
          aria-describedby={described}
          className={`${base} h-11`}
        />
      )}

      {hint && field.type !== "boolean" ? (
        <p id={described} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
