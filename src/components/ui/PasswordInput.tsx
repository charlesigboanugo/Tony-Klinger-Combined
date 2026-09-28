"use client";

import { useState, type ComponentProps, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";

/**
 * Password input with a reveal toggle and a Caps Lock warning — note 10 §25.
 *
 * The two most common reasons a correct password is rejected are a typo you
 * cannot see and Caps Lock. Showing the text on request answers the first;
 * reading the modifier state on each keystroke answers the second before the
 * form is even sent.
 *
 * The toggle is a real button with `aria-pressed`, labelled for what it does,
 * and it sits inside the field's edge so it never shifts the layout. It is
 * `type="button"` so pressing it cannot submit the form.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const readCaps = (event: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  return (
    <div>
      <div className="relative">
        <Input
          {...props}
          type={visible ? "text" : "password"}
          onKeyDown={readCaps}
          onKeyUp={readCaps}
          onBlur={() => setCapsLock(false)}
          className={cn("pr-12", className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={props.name}
          aria-label="Show password"
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-(--radius) text-muted-foreground transition-colors hover:text-accent focus-visible:outline-offset-[-3px]"
        >
          <EyeIcon crossed={visible} />
        </button>
      </div>

      <div aria-live="polite">
        {capsLock ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-warning">
            <span aria-hidden="true">&#8682;</span>
            Caps Lock is on
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The slash DRAWS in when the password is shown (a stroke-dash transition)
 * rather than the icon swapping, so the state change reads as a change, not a
 * flicker.
 */
function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path
        d="M4 4l16 16"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={crossed ? 0 : 1}
        className="transition-[stroke-dashoffset] duration-(--dur-base) ease-expo"
      />
    </svg>
  );
}
