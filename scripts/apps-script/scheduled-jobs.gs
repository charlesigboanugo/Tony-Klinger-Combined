/**
 * Scheduled jobs for the TEST deploy, run by Google Apps Script (owner,
 * 2026-10-24). GitHub's scheduler started runs late and dropped most of them;
 * Apps Script triggers keep time. It calls the same authenticated
 * /api/cron/<job> routes Vercel Cron will call at launch (note 09 §44), on the
 * schedules in vercel.json.test.
 *
 * SET UP, once, at script.google.com → New project → paste this file:
 *   1. Project Settings → Script Properties → add
 *        SITE_URL     https://tonyklinger-combined-website.vercel.app
 *        CRON_SECRET  the same value as CRON_SECRET on Vercel
 *      (kept there, never in this code).
 *   2. Choose `installTriggers` in the toolbar and Run. Allow the permissions
 *      it asks for (calling an external URL, managing its own triggers).
 *   3. Choose `testConnection` and Run: the log should show send-emails 200.
 *
 * Run `installTriggers` again after editing the schedules: it removes the old
 * triggers first, so they never double up. `removeTriggers` stops everything.
 * A failed call throws, so Google emails a failure summary to the script owner.
 *
 * Apps Script cannot offset a trigger within the hour, so session reminders run
 * every 15 minutes on the quarter hour (vercel.json.test: 5,20,35,50) and daily
 * jobs run somewhere within their hour. Every job catches up on outstanding
 * work, so neither matters.
 */

function everyFiveMinutes() { runJobs(["send-emails"]); }
function everyFifteenMinutes() { runJobs(["reconcile-stripe", "event-reminders", "session-reminders"]); }
function hourly() { runJobs(["expire-entitlements", "sync-stripe"]); }
function dailyAt3() { runJobs(["cleanup-tokens", "cleanup-uploads"]); }
function dailyAt4() { runJobs(["sync-audiences"]); }
function dailyAt9() { runJobs(["pass-reminders"]); }

function installTriggers() {
  removeTriggers();
  ScriptApp.newTrigger("everyFiveMinutes").timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger("everyFifteenMinutes").timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger("hourly").timeBased().everyHours(1).create();
  // UTC, like Vercel Cron, whatever time zone the project is set to.
  ScriptApp.newTrigger("dailyAt3").timeBased().everyDays(1).atHour(3).inTimezone("Etc/UTC").create();
  ScriptApp.newTrigger("dailyAt4").timeBased().everyDays(1).atHour(4).inTimezone("Etc/UTC").create();
  ScriptApp.newTrigger("dailyAt9").timeBased().everyDays(1).atHour(9).inTimezone("Etc/UTC").create();
  Logger.log("Installed " + ScriptApp.getProjectTriggers().length + " triggers.");
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
}

function testConnection() { runJobs(["send-emails"]); }

/** Calls each job; throws at the end if any failed, after trying them all. */
function runJobs(jobs) {
  var props = PropertiesService.getScriptProperties();
  var site = String(props.getProperty("SITE_URL") || "").replace(/\/$/, "");
  var secret = props.getProperty("CRON_SECRET");
  if (!site || !secret) throw new Error("Set SITE_URL and CRON_SECRET in Project Settings → Script Properties.");

  var failed = [];
  jobs.forEach(function (job) {
    var response = UrlFetchApp.fetch(site + "/api/cron/" + job, {
      method: "get",
      headers: { Authorization: "Bearer " + secret },
      muteHttpExceptions: true,
      followRedirects: false,
    });
    var status = response.getResponseCode();
    Logger.log(job + " " + status + " " + response.getContentText().slice(0, 200));
    if (status !== 200) failed.push(job + " (" + status + ")");
  });
  if (failed.length) throw new Error("Failed: " + failed.join(", "));
}
