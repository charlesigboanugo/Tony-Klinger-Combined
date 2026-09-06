import { NextResponse, type NextRequest } from "next/server";

import { requireServerEnv } from "@/lib/env/server";
import { JOBS } from "@/lib/jobs";

/**
 * Scheduled jobs — note 01 §18, note 09 §44.
 *
 * Vercel Cron is the single scheduler and invokes these routes. Each one is a
 * THIN authenticated entry point that calls a shared operation in `src/lib`;
 * the logic never lives here, so the same work can be run by a schedule, an
 * admin action or a reconciliation pass without being written twice.
 *
 * A cron endpoint is a public URL. It authenticates before doing anything.
 *
 * Verified against Vercel's cron documentation, 2026-09:
 *
 *   - Invocations arrive as GET. An endpoint exporting only POST returns 405
 *     and the job silently never runs.
 *   - Authentication is `Authorization: Bearer $CRON_SECRET`, sent
 *     automatically when a `CRON_SECRET` environment variable exists on the
 *     project. There is no `x-vercel-cron-secret` header; the only cron header
 *     is `x-vercel-cron-schedule`, which carries the expression that fired.
 *   - Vercel does NOT retry a failed invocation, and delivery is best effort —
 *     a run can be missed, or delivered twice. Every job must therefore be
 *     idempotent and reconciliation-based, catching up on outstanding work
 *     rather than assuming the previous run happened exactly once.
 *   - Redirects are not followed, so this must answer directly.
 */
function authorized(request: NextRequest): boolean {
  const expected = requireServerEnv("CRON_SECRET");
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

async function handle(
  request: NextRequest,
  params: Promise<{ job: string }>,
) {
  if (!authorized(request)) {
    // No detail: an unauthenticated caller learns nothing about which jobs exist.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { job } = await params;
  const run = JOBS[job as keyof typeof JOBS];

  if (!run) {
    return NextResponse.json({ error: "unknown job" }, { status: 404 });
  }

  try {
    const result = await run();
    return NextResponse.json({
      job,
      // Which schedule fired, when several share a path.
      schedule: request.headers.get("x-vercel-cron-schedule"),
      result,
    });
  } catch (error) {
    console.error("cron job failed", {
      job,
      message: error instanceof Error ? error.message : "unknown",
    });
    // Vercel does not retry, so this status is for observability, not recovery:
    // the failure must be visible in the logs, and the next scheduled run picks
    // up the outstanding work because every job is reconciliation-based.
    return NextResponse.json({ error: "job failed" }, { status: 500 });
  }
}

/** How Vercel Cron invokes the endpoint. */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/cron/[job]">,
) {
  return handle(request, params);
}

/** Kept for manual and local runs, which are easier to issue as POST. */
export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/cron/[job]">,
) {
  return handle(request, params);
}
