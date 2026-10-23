"use client";

import { useEffect } from "react";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const MESSAGE_ATTR = "data-field-error";
const OWNED_INVALID = "fieldErrorOwnsInvalid";

/**
 * Site-wide replacement for the browser's validation bubble — note 10 §25.
 *
 * Every form keeps its native `required`, `type="email"`, `minLength` and so
 * on, so the browser still refuses to submit an incomplete form. What changes
 * is how it says so: the generic "Please fill out this field" tooltip (which
 * vanishes after a few seconds and names no field) is cancelled, and a plain
 * message naming the field is written under it instead, in the same style as
 * the server's field errors. The first problem field takes focus.
 *
 * One listener on the document, so every form on the site, now and later, is
 * covered without each one opting in. Forms with `noValidate` (contact,
 * newsletter) never raise `invalid` and keep their own server-side messages.
 */
export function FieldValidation() {
  useEffect(() => {
    // Invalid events for one submit attempt fire in one task, in document
    // order; only the first of each batch takes focus. A timeout, not a
    // microtask: microtasks run between the browser's event dispatches.
    let focusedThisBatch = false;

    const onInvalid = (event: Event) => {
      const control = event.target;
      if (!isControl(control)) return;
      event.preventDefault();
      showMessage(control, messageFor(control));

      if (!focusedThisBatch) {
        focusedThisBatch = true;
        setTimeout(() => {
          focusedThisBatch = false;
        });
        control.focus({ preventScroll: true });
        control.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };

    // A message stays until the field is changed, then re-checks: corrected
    // fields clear at once, a still-wrong one updates to the current reason.
    const onEdit = (event: Event) => {
      const control = event.target;
      if (!isControl(control)) return;
      // A radio group shares one message; any member clears it.
      const group = radioGroup(control);
      const targets = group.length ? group : [control];
      if (!targets.some((el) => messageElement(el))) return;
      if (control.validity.valid) targets.forEach(clearMessage);
      else showMessage(control, messageFor(control));
    };

    // A submit that got past validation clears everything, so stale messages
    // never sit beside the server's own errors.
    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      form.querySelectorAll<Control>("input, select, textarea").forEach(clearMessage);
    };

    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return null;
}

function isControl(target: EventTarget | null): target is Control {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

function radioGroup(control: Control): HTMLInputElement[] {
  if (!(control instanceof HTMLInputElement) || control.type !== "radio" || !control.name) {
    return [];
  }
  const scope = control.form ?? document;
  return Array.from(
    scope.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(control.name)}"]`),
  );
}

/**
 * Where the message goes: after the control, or after the wrapper that the
 * control has to share with something positioned against it (the password
 * reveal button), the label around a tick box, or the fieldset of a radio
 * group, so it never lands inside a layout it would break.
 */
function anchorFor(control: Control): Element {
  if (control instanceof HTMLInputElement) {
    if (control.type === "radio") return control.closest("fieldset") ?? control.closest("label") ?? control;
    if (control.type === "checkbox") return control.closest("label") ?? control;
  }
  return control.closest("[data-field-anchor]") ?? control;
}

function messageId(control: Control): string {
  const base = control.id || control.name || "field";
  return `${base}-check`;
}

function messageElement(control: Control): HTMLElement | null {
  const next = anchorFor(control).nextElementSibling;
  return next instanceof HTMLElement && next.hasAttribute(MESSAGE_ATTR) ? next : null;
}

function showMessage(control: Control, text: string) {
  const anchor = anchorFor(control);
  let el = messageElement(control);
  if (!el) {
    el = document.createElement("p");
    el.setAttribute(MESSAGE_ATTR, "");
    el.id = messageId(control);
    el.setAttribute("role", "alert");
    el.className = "text-sm text-error";
    anchor.after(el);
    // In a spaced stack the gap is already there; elsewhere give it one.
    if (parseFloat(getComputedStyle(anchor).marginBottom) === 0) {
      el.style.marginTop = "0.5rem";
    }
  }
  el.textContent = text;

  if (control.getAttribute("aria-invalid") !== "true") {
    control.setAttribute("aria-invalid", "true");
    control.dataset[OWNED_INVALID] = "";
  }
  const described = (control.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
  if (!described.includes(el.id)) {
    control.setAttribute("aria-describedby", [...described, el.id].join(" "));
  }
}

function clearMessage(control: Control) {
  const el = messageElement(control);
  if (!el) return;
  const described = (control.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter((id) => id && id !== el.id);
  if (described.length) control.setAttribute("aria-describedby", described.join(" "));
  else control.removeAttribute("aria-describedby");
  // Only undo aria-invalid this handler set; one from a server error stays.
  if (OWNED_INVALID in control.dataset) {
    control.removeAttribute("aria-invalid");
    delete control.dataset[OWNED_INVALID];
  }
  el.remove();
}

/** The field's name as the person sees it, without a trailing "*" or "(optional)". */
function fieldName(control: Control): string | null {
  const raw =
    control.labels?.[0]?.textContent ??
    control.getAttribute("aria-label") ??
    (control.getAttribute("aria-labelledby")
      ? document.getElementById(control.getAttribute("aria-labelledby")!)?.textContent
      : null) ??
    null;
  const name = raw?.replace(/\*/g, "").replace(/\s+/g, " ").trim();
  return name ? name : null;
}

function messageFor(control: Control): string {
  const v = control.validity;
  const name = fieldName(control);
  const type = control instanceof HTMLInputElement ? control.type : control.tagName.toLowerCase();
  const isDate = ["date", "datetime-local", "time", "month", "week"].includes(type);

  if (v.customError) return control.validationMessage;

  if (v.valueMissing) {
    if (type === "checkbox") return "Tick this box to continue.";
    if (type === "radio") return "Choose one of the options.";
    if (type === "file") return "Choose a file to upload.";
    if (type === "email") {
      return !name || /^(your )?email( address)?$/i.test(name)
        ? "Enter your email address."
        : `Enter ${lowerFirst(name)}.`;
    }
    if (type === "password") {
      if (name && /confirm/i.test(name)) return "Type the new password again to confirm it.";
      return name ? `Enter your ${name.toLowerCase()}.` : "Enter your password.";
    }
    if (control instanceof HTMLSelectElement) return name ? `Choose ${lowerFirst(name)}.` : "Choose an option.";
    if (isDate) return name ? `Choose ${lowerFirst(name)}.` : "Choose a date.";
    if (name && /^(your |full )?name$/i.test(name)) return "Enter your name.";
    return name ? `${name} can't be empty.` : "This field can't be empty.";
  }

  if (v.typeMismatch) {
    if (type === "email") return "That doesn't look like an email address. It should look like name@example.com.";
    if (type === "url") return "Enter a full web address, starting with https://.";
  }

  if (v.badInput) {
    if (type === "number") return "Enter a number, using digits only.";
    if (isDate) return "Enter a complete date.";
  }

  const label = name ?? "This";
  const el = control as HTMLInputElement;

  if (v.tooShort) {
    return `${label} needs at least ${el.minLength} characters. You've typed ${el.value.length}.`;
  }
  if (v.tooLong) return `${label} can be at most ${el.maxLength} characters.`;
  if (v.rangeUnderflow) {
    return isDate ? `${label} can't be before ${el.min}.` : `${label} must be ${el.min} or more.`;
  }
  if (v.rangeOverflow) {
    return isDate ? `${label} can't be after ${el.max}.` : `${label} must be ${el.max} or less.`;
  }
  if (v.stepMismatch) {
    return el.step === "1" || el.step === "" ? `${label} must be a whole number.` : `${label} isn't a value that can be used here.`;
  }
  if (v.patternMismatch) return el.title || `${label} isn't in the right format.`;

  return control.validationMessage;
}

function lowerFirst(text: string): string {
  // "Product" → "a product" reads oddly; "Choose product" doesn't. Keep a
  // label's capitals (names, acronyms) but drop the leading one.
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}
