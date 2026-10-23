"use client";

import { useActionState } from "react";

import { scheduleSeriesAction, type ScheduleState } from "@/app/admin/schedule/actions";
import { FormGrid, Wide } from "@/components/admin/AdminForm";
import { Field, FormMessage, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function ScheduleForm({ series }: { series: Array<{ id: string; name: string; sessions: number }> }) {
  const [state, action] = useActionState<ScheduleState, FormData>(scheduleSeriesAction, {});

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
        <Input name="first" type="datetime-local" required />
      </Field>

      <Field
        label="Registration opens"
        name="opens"
        hint="UK time. Leave empty to open it now. Nothing can be bought for this run before then, or once it has started."
      >
        <Input name="opens" type="datetime-local" />
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

      <Wide className="flex justify-end border-t border-border pt-5">
        <SubmitButton pendingLabel="Creating…">Create the run</SubmitButton>
      </Wide>
      </FormGrid>
    </form>
  );
}
