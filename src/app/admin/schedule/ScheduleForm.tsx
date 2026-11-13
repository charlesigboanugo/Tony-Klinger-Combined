"use client";

import { useActionState, useState } from "react";

import { scheduleSeriesAction, type ScheduleState } from "@/app/admin/schedule/actions";
import { FormGrid, Toggle, Wide } from "@/components/admin/AdminForm";
import { DateTimePicker } from "@/components/admin/DateTimePicker";
import { Field, FormMessage, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ukTodayStartLocal } from "@/lib/utils/uk-time";

export function ScheduleForm({
  series,
  zoomUnavailable,
}: {
  series: Array<{ id: string; name: string; sessions: number }>;
  /** Why Run on Zoom can't be switched on (Zoom isn't connected). */
  zoomUnavailable?: string;
}) {
  const [state, action] = useActionState<ScheduleState, FormData>(scheduleSeriesAction, {});
  // Nothing before today is offered (owner, 2026-11-12); days, so the server
  // and the browser agree when the page hydrates.
  const [today] = useState(() => ukTodayStartLocal());

  return (
    <form action={action}>
      <FormGrid>
      {state.error || state.success ? (
        <Wide>
          {state.error ? <FormMessage>{state.error}</FormMessage> : null}
          {state.success ? <FormMessage tone="success">{state.success}</FormMessage> : null}
        </Wide>
      ) : null}

      <Wide>
        <Field label="Series" name="series">
          {/* Starts on nothing chosen, like every picker (owner, 2026-10-23). */}
          <Select name="series" required defaultValue="">
            <option value="">Choose a series…</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.sessions} topics)
              </option>
            ))}
          </Select>
        </Field>
      </Wide>

      <Field label="First session" name="first" hint="UK time. The rest follow at the same time each week. Registration closes when this session starts.">
        <DateTimePicker id="schedule-first" name="first" min={today} required />
      </Field>

      <Field
        label="Registration opens"
        name="opens"
        hint="UK time. Leave empty to open it now. Nothing can be bought for this run before then, or once it has started."
      >
        <DateTimePicker id="schedule-opens" name="opens" min={today} />
      </Field>

      <Field label="Places" name="capacity" hint="Leave empty to use the series' group size. Registration closes when they are taken.">
        <Input name="capacity" type="number" min={1} max={500} />
      </Field>

      <Field
        label="Name of this run"
        name="label"
        hint="How customers tell two runs of a series apart. Leave empty and it is written from the day and time: &quot;Tuesdays, 4pm&quot;."
      >
        <Input name="label" maxLength={60} />
      </Field>

      <Field label="Number of sessions" name="count" hint="Eight is a full series. Each takes its title from the series' topics, in order.">
        <Input name="count" type="number" min={1} max={52} defaultValue={8} required />
      </Field>

      <Field label="Length (minutes)" name="minutes">
        <Input name="minutes" type="number" min={15} max={480} defaultValue={60} required />
      </Field>

      <Wide>
      <Field
        label="Joining link"
        name="meeting_url"
        hint="Optional. Used for every session created; each can be changed afterwards. Shown only to people who booked, from 15 minutes before the start."
      >
        <Input name="meeting_url" type="url" placeholder="https://" />
      </Field>
      </Wide>

      <Wide>
        <Toggle
          id="schedule-uses-zoom"
          name="uses_zoom"
          label="Run on Zoom"
          disabled={Boolean(zoomUnavailable)}
          hint={zoomUnavailable ?? "On: the site creates a Zoom meeting for every session of the run, and gives each person on it their own joining link, which works on one device at a time. The joining link above is then not needed."}
        />
      </Wide>

      <Wide className="flex justify-end border-t border-border pt-5">
        <SubmitButton pendingLabel="Creating…">Create the run</SubmitButton>
      </Wide>
      </FormGrid>
    </form>
  );
}
