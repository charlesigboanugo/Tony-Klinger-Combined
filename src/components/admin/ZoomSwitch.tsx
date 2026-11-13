"use client";

import { useFormStatus } from "react-dom";

import { toggleZoomAction } from "@/app/admin/actions";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { cn } from "@/lib/utils/cn";

/**
 * "Run on Zoom" as a switch in an admin list (owner, 2026-11-13), the same
 * look as the form's `Toggle`. Turning it on saves at once and the meeting is
 * made; turning it off asks first, because the meeting is deleted and every
 * personal link stops working (owner: anything that cancels or deletes asks).
 */
export function ZoomSwitch({
  slug,
  id,
  on,
  title,
  back,
  disabledReason,
  links,
}: {
  /** The admin resource the row belongs to. */
  slug: string;
  id: string;
  on: boolean;
  /** The item's name, for the question when turning it off. */
  title: string;
  /** The list's own address, to return to as it was. */
  back: string;
  /** Why it cannot be switched here (finished, in person); shown on hover. */
  disabledReason?: string;
  /** People holding their own link now; undefined where there are none (private coaching). */
  links?: number;
}) {
  if (disabledReason) {
    return (
      <span title={disabledReason} className="inline-flex items-center gap-2 opacity-50">
        <Track on={on} />
        <span className="text-xs text-muted-foreground">{on ? "On" : "Off"}</span>
      </span>
    );
  }

  return (
    <form action={toggleZoomAction}>
      <input type="hidden" name="__resource" value={slug} />
      <input type="hidden" name="__id" value={id} />
      <input type="hidden" name="__back" value={back} />
      <input type="hidden" name="on" value={on ? "0" : "1"} />
      {on ? (
        <ConfirmSubmit
          variant="ghost"
          size="sm"
          className="min-h-0 gap-2 px-1 py-1 hover:bg-transparent"
          destructive
          title={`Turn Zoom off for ${title}?`}
          confirmLabel="Turn Zoom off"
          cancelLabel="Keep it on"
          pendingLabel="Turning off…"
          points={[
            "Its Zoom meeting is deleted.",
            links === undefined
              ? "The client's joining link stops working, including in emails already sent."
              : links > 0
                ? `${links} ${links === 1 ? "person has their own link" : "people have their own link"}, and ${links === 1 ? "it stops" : "every one stops"} working, including links already emailed.`
                : "Nobody has been given a link yet, so nobody loses one.",
            "People see the joining link set on the item instead, if there is one.",
          ]}
          note="Turning Zoom back on makes a new meeting, and everyone is given a new link."
        >
          <Track on />
          <span className="text-xs font-medium text-accent">On</span>
        </ConfirmSubmit>
      ) : (
        <TurnOn />
      )}
    </form>
  );
}

function TurnOn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={false}
      aria-label="Run on Zoom"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait"
    >
      <Track on={pending} />
      <span className="text-xs font-medium text-muted-foreground">{pending ? "Turning on…" : "Off"}</span>
    </button>
  );
}

/** The switch itself, drawn as the form's `Toggle` draws it. */
function Track({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-foreground/20")}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none",
          on && "translate-x-5",
        )}
      />
    </span>
  );
}
