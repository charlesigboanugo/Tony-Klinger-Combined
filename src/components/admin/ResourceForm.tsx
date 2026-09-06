"use client";

import Link from "next/link";
import { useActionState } from "react";

import { saveResourceAction, type AdminFormState } from "@/app/admin/actions";
import { MediaPicker, type MediaOption } from "@/components/admin/MediaPicker";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Field, ResourceConfig } from "@/lib/admin/resources";

/**
 * Generated create/edit form — note 06 §14, note 10 §23.
 *
 * Rendered from the resource's field declarations, so every admin area gets the
 * same validation, the same layout and the same error handling. Adding a column
 * is one line in `resources.ts` rather than edits across a page, a form and
 * three actions.
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
}: {
  resource: ResourceConfig;
  row?: Record<string, unknown> | null;
  /** The image library, passed in only when this resource has a media field. */
  media?: MediaOption[];
  /** Options for each `reference` field, keyed by field name. */
  references?: Record<string, Array<{ id: string; label: string }>>;
}) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    saveResourceAction,
    {},
  );

  const id = row?.id ? String(row.id) : undefined;

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <input type="hidden" name="__resource" value={resource.slug} />
      {id ? <input type="hidden" name="__id" value={id} /> : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-(--radius) border border-error bg-error/10 px-3 py-2 text-sm text-error"
        >
          {state.error}
        </p>
      ) : null}

      {resource.fields
        // A read-only field is set by the system — the Stripe product id, for
        // instance. Shown when editing so an operator can see it, never
        // offered as an input.
        .filter((field) => !field.readOnly || id)
        .map((field) => (
          <FormField
            key={field.name}
            field={field}
            value={row?.[field.name]}
            media={media}
            references={references}
          />
        ))}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton>{id ? "Save changes" : `Create ${resource.labelSingular.toLowerCase()}`}</SubmitButton>
        <Link
          href={`/admin/${resource.slug}`}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function FormField({
  field,
  value,
  media,
  references,
}: {
  field: Field;
  value: unknown;
  media: MediaOption[];
  references: Record<string, Array<{ id: string; label: string }>>;
}) {
  const id = `field-${field.name}`;
  const described = field.hint ? `${id}-hint` : undefined;
  const disabled = field.readOnly;

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
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {field.label}
        {field.required ? <span className="ml-1 text-error">*</span> : null}
      </label>

      {field.type === "reference" ? (
        <select
          id={id}
          name={field.name}
          required={field.required}
          disabled={disabled}
          defaultValue={asInputValue()}
          aria-describedby={described}
          className={`${base} h-11`}
        >
          <option value="">—</option>
          {(references[field.name] ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === "media" ? (
        <MediaPicker
          name={field.name}
          options={media}
          defaultValue={value ? String(value) : null}
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
        <select
          id={id}
          name={field.name}
          required={field.required}
          disabled={disabled}
          defaultValue={asInputValue()}
          aria-describedby={described}
          className={`${base} h-11`}
        >
          <option value="">—</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option.replace(/[_-]/g, " ")}
            </option>
          ))}
        </select>
      ) : field.type === "boolean" ? (
        <div className="flex items-center gap-2.5">
          <input
            id={id}
            name={field.name}
            type="checkbox"
            disabled={disabled}
            defaultChecked={value === true}
            aria-describedby={described}
            className="h-4 w-4 rounded border-input-border accent-(--accent)"
          />
          <label htmlFor={id} className="text-sm text-muted-foreground">
            {field.hint ?? "Enabled"}
          </label>
        </div>
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

      {field.hint && field.type !== "boolean" ? (
        <p id={described} className="text-xs text-muted-foreground">
          {field.hint}
        </p>
      ) : null}
    </div>
  );
}
