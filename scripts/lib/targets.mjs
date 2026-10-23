// Which database a maintenance script works on: the local stack, or the hosted
// TEST project — never anything else (owner, 2026-10-23).
//
//   no --env       the local database (127.0.0.1:54322)
//   --env <file>   the TEST project: SUPABASE_DB_URL from that file, or else
//                  built from what is already on this machine — the pooler
//                  address the linked Supabase CLI keeps
//                  (supabase/.temp/pooler-url, no password in it) and
//                  SUPABASE_DB_PASSWORD from .env.local
//
// Anything that is not the test project is refused before connecting, so a
// production address can never be reached through these scripts.
import fs from "node:fs";

/** The hosted TEST project (TKOC-COMBINED-FREE). Nothing else is accepted. */
export const TEST_PROJECT_REF = "hetmwpcdqmozyrmkxjyx";
const LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split("\n")
      .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
  );
}

function testDbUrl(env) {
  if (env.SUPABASE_DB_URL) return env.SUPABASE_DB_URL;
  const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim() : "");
  const pooler = read("supabase/.temp/pooler-url");
  const linkedRef = read("supabase/.temp/project-ref");
  const password = readEnv(".env.local").SUPABASE_DB_PASSWORD;
  if (!pooler || linkedRef !== TEST_PROJECT_REF || !password) return null;
  const url = new URL(pooler);
  url.password = encodeURIComponent(password);
  return url.toString();
}

/**
 * The target named by the command line: `{ local, envFile, env, dbUrl, ssl }`.
 * Exits with a message when the test project's address can't be found or a
 * non-test address is given.
 */
export function target(argv) {
  const envFile = argv.includes("--env") ? argv[argv.indexOf("--env") + 1] : null;
  if (!envFile) return { local: true, envFile: ".env.local", env: readEnv(".env.local"), dbUrl: LOCAL_URL, ssl: false };

  const env = readEnv(envFile);
  const dbUrl = testDbUrl(env);
  if (!dbUrl) {
    console.error(
      `No test database address. Either add SUPABASE_DB_URL to ${envFile}, or keep the Supabase CLI linked to the test ` +
        "project (supabase link) with SUPABASE_DB_PASSWORD in .env.local.",
    );
    process.exit(1);
  }
  if (!dbUrl.includes(TEST_PROJECT_REF)) {
    console.error("Refused: that database is not the test project. These scripts only run on local and test.");
    process.exit(1);
  }
  return { local: false, envFile, env, dbUrl, ssl: "require" };
}
