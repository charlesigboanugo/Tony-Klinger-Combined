// Uploads captured site images into Supabase Storage and catalogues them.
//
// NO AUTOMATIC COVER ASSIGNMENT. The source filenames are meaningless
// (Facebook export ids, numbered PNGs) and the page-usage data yields
// incidental images — inspecting them showed a radio presenter's portrait
// matched to a novel and a stock photo matched to a film. Assigning those would
// put a wrong image on a customer-facing page, which is worse than none.
// Provenance is recorded instead so a person can choose.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const SITES = [
  ["tonydklinger.com", "main"],
  ["tonyklingercoaching.com", "coaching"],
  ["tonyklingeronlinecoaching.com", "app"],
];

const MIME = { ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png",
               ".webp":"image/webp", ".gif":"image/gif", ".avif":"image/avif" };

// site-media caps at 15 MB. Anything larger is reported, not silently skipped.
const MAX = 15 * 1024 * 1024;

// Which page each file appeared on, where known — the only provenance available.
let usage = {};
try {
  usage = JSON.parse(fs.readFileSync(
    "current-website/tonydklinger.com/pages/_assets-crossref.json", "utf8")).usage ?? {};
} catch {}

const seen = new Map();      // content hash -> storage path, to skip duplicates
const rows = [];
let uploaded = 0, skipped = 0, tooBig = 0, failed = 0;

// BOTH image folders, not just the export.
//
// `images/` is the Wix Media Manager export — the whole media library,
// including a great deal that no page ever used. `images-from-web/` is the
// opposite set: images the crawler found actually DISPLAYED on the live pages
// whose originals the export omitted, downloaded from wixstatic at full size.
//
// Reading only the first left ~125 images out of the platform entirely — among
// them the portraits for several Stories From The Front Line entries, which is
// why those works appeared here without the images they had on the real site.
for (const [dir, label] of SITES) {
for (const folder of ["images", "images-from-web"]) {
  const base = `current-website/${dir}/site-files/${folder}`;
  if (!fs.existsSync(base)) continue;

  for (const name of fs.readdirSync(base)) {
    const full = path.join(base, name);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;

    const ext = path.extname(name).toLowerCase();
    const type = MIME[ext];
    if (!type) { skipped++; continue; }
    if (stat.size > MAX) { tooBig++; console.log(`  TOO BIG (${(stat.size/1048576).toFixed(1)}MB) ${name}`); continue; }

    const bytes = fs.readFileSync(full);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    if (seen.has(hash)) { skipped++; continue; }

    // Path carries the source site, then a hash-prefixed filename: the sources
    // contain same-named files, and a collision would silently overwrite one.
    const safe = name.replace(/[^A-Za-z0-9._-]/g, "-");
    const objectPath = `imported/${label}/${hash.slice(0, 8)}-${safe}`;

    const res = await fetch(`${URL_BASE}/storage/v1/object/site-media/${encodeURI(objectPath)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": type, "x-upsert": "true" },
      body: bytes,
    });

    if (!res.ok) {
      failed++;
      if (failed <= 3) console.log(`  FAILED ${name}: ${res.status} ${(await res.text()).slice(0,120)}`);
      continue;
    }

    seen.set(hash, objectPath);
    uploaded++;
    const pages = (usage[name] ?? []).map((u) => u.page);
    rows.push({ path: objectPath, name, label, pages });
  }
}
}

// Catalogue what was uploaded. `supabase db reset` wipes storage.objects AND
// the resources table, so this script is the repeatable path back to a
// populated local environment — seed.sql cannot upload files.
if (rows.length > 0) {
  const records = rows.map((r) => {
    const pages = [...new Set(r.pages)].sort().join(", ");
    const title = (pages ? `${r.name} — used on ${pages}` : r.name).slice(0, 200);
    return { title, resource_type: "image", storage_path: `site-media/${r.path}` };
  });

  // Chunked: one statement with 350+ rows is fine for Postgres but the REST
  // endpoint has a request size limit.
  for (let i = 0; i < records.length; i += 100) {
    const res = await fetch(`${URL_BASE}/rest/v1/resources?on_conflict=storage_path`, {
      method: "POST",
      headers: {
        apikey: KEY,
        authorization: `Bearer ${KEY}`,
        "content-type": "application/json",
        prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(records.slice(i, i + 100)),
    });
    if (!res.ok) console.log(`  catalogue chunk ${i} failed: ${res.status} ${(await res.text()).slice(0, 140)}`);
  }
}

// Link team photos by filename.
//
// `seed.sql` creates the team before this script runs, so at seed time the
// resources table is empty and every photo_resource_id is null. Relinking here
// means one command — `pnpm images:import` — restores a fully populated local
// environment after a reset, rather than leaving the About page without faces.
//
// Filename matching is reliable for exactly these files (`tony.webp`,
// `helen.JPG`); the main site's images are Facebook export ids and are
// deliberately left for a person to assign.
const TEAM_PHOTOS = {
  "tony-klinger": "tony.webp",
  "louize-yafai": "louize.webp",
  "elaine-harrison": "elaine.webp",
  "jon-mackley": "john.webp",
  "helen-kenworthy": "helen.JPG",
};

// Catalogue covers, each VERIFIED BY LOOKING AT THE IMAGE rather than inferred
// from its filename or the page it appeared on. An automated pass matched a
// radio presenter's portrait to a novel and a stock photo to a film, which is
// why only these seven are assigned and the other 349 wait for a person.
const COVERS = {
  "the-man-who-got-carter": "ART_FilmPoster_Final.JPG",
  "the-butterfly-boy": "ButterflyBoy_Pic.PNG",
  "the-who-and-i": "TWAI_audio3.PNG",
  "who-knows-making-of-a-rock-movie": "2.png",
  "deep-purple-rises-over-japan": "8xOxnmb5cvRqCLtPy5680loBcO1.jpg",
  "rachels-man": "51MBFB5XQRL._AC_.jpg",
  "gold": "Gold_poster.PNG",

  // Added 2026-09-04, each opened and looked at before being listed here —
  // the same bar the seven above were held to.
  //
  // A SECOND automated pass was attempted first and reverted. It repeated the
  // failure this comment already warned about: it assigned a pxfuel stock photo
  // to The Havana Chronicles, and `SleepingItOff.PNG` to The Kids Are Alright
  // while the actual poster sat in the export under its own name. Page
  // association is not identification.
  "the-kids-are-alright": "TheKidsAreAlright_pic.PNG",   // the 1979 Who poster
  "riding-high": "RidingHigh_poster.PNG",                // "A Michael and Tony Klinger Production"
  "sisters": "SISTERS Poster.png",                       // Give-Get-Go presents; exec producer Tony Klinger
  "under-gods-table": "UnderGodsTable_pic.PNG",          // the novel's cover
  "orson-welles": "Orosn-Welles.jpg",                    // portrait (filename is misspelled at source)
  "mickey-rooney": "mickeyrooney.jpg",                   // portrait
  "roy-budd-": "roy-budd.jpg",                           // portrait
  "lee-marvin": "Lee_marvin_1971.jpg",                   // portrait

  // Stories From The Front Line. Each of these was the ONLY image on that
  // subject's own crawled page, and each was opened and checked: Twiggy's 1966
  // portrait, Deep Purple's Mark II line-up, and period portraits of the three
  // composers — Jarre photographed working from a score.
  //
  // Their stored filenames are useless ("download.jpg", "unnamedddd.jpg"),
  // which is exactly why no filename heuristic could ever have found them and
  // why they are listed explicitly.
  "deep-purple": "zap_purple.jpg",
  "elmer-bernstein": "download.jpg",
  "henry-mancini": "unnamedddd.jpg",
  "maurice-jarre": "unnamed--1-.jpg",
  "twiggy": "67987d_c95b88b7466c4b94891a11c9e098d087~mv2.png",
};

// Names are sanitised on upload (line ~64), so a COVERS key written as it
// appears on disk — "SISTERS Poster.png" — never matches the stored
// "SISTERS-Poster.png". Sanitise here too, so both spellings work.
const findResource = async (file) => {
  const stored = file.replace(/[^A-Za-z0-9._-]/g, "-");
  const res = await fetch(
    `${URL_BASE}/rest/v1/resources?select=id&storage_path=like.*-${encodeURIComponent(stored)}&limit=1`,
    { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } },
  );
  const [row] = await res.json().catch(() => []);
  return row?.id ?? null;
};

let covers = 0;
for (const [slug, file] of Object.entries(COVERS)) {
  const id = await findResource(file);
  if (!id) {
    console.log(`  COVER NOT FOUND: ${slug} -> ${file} (no resource matches)`);
    continue;
  }
  const res = await fetch(`${URL_BASE}/rest/v1/catalogue_items?slug=eq.${slug}`, {
    method: "PATCH",
    headers: {
      apikey: KEY, authorization: `Bearer ${KEY}`,
      "content-type": "application/json", prefer: "return=minimal",
    },
    body: JSON.stringify({ cover_resource_id: id }),
  });
  if (res.ok) covers++;
}

let linked = 0;
for (const [slug, file] of Object.entries(TEAM_PHOTOS)) {
  const resourceId = await findResource(file);
  if (!resourceId) continue;

  const res = await fetch(`${URL_BASE}/rest/v1/team_members?slug=eq.${slug}`, {
    method: "PATCH",
    headers: {
      apikey: KEY, authorization: `Bearer ${KEY}`,
      "content-type": "application/json", prefer: "return=minimal",
    },
    body: JSON.stringify({ photo_resource_id: resourceId }),
  });
  if (res.ok) linked++;
}

// Course and private-coaching covers, verified the same way as the catalogue
// ones above — moved HERE from migration 0033 because a migration cannot do
// this job. Migrations run as part of `db reset`, which is BEFORE this
// script ever uploads anything, so an exact `storage_path` match against a
// still-empty `resources` table matched nothing on every single fresh
// reset — silently, since the UPDATE's `where ... is null` guard makes "0
// rows matched" indistinguishable from "already assigned". Found by running
// `db reset` then this script and checking `courses.cover_resource_id`
// directly: three courses and one coaching service had never once been
// assigned a cover by the normal reset workflow, despite migration 0033
// naming the exact right files. The hash-prefixed path is deterministic
// (content-hashed, note the `seen` map above), so the same three files
// resolve to the same paths every run — this just needed to run at the
// point in the sequence where `resources` actually has rows in it.
const COURSE_COVERS = {
  "level-one": "Level-1-groove.jpg",
  "level-two": "Level-2-guu.jpg",
  "level-three": "Level-3-Improved.jpg",
};

let courseCovers = 0;
for (const [slug, file] of Object.entries(COURSE_COVERS)) {
  const id = await findResource(file);
  if (!id) continue;
  const res = await fetch(
    `${URL_BASE}/rest/v1/courses?slug=eq.${slug}&cover_resource_id=is.null`,
    {
      method: "PATCH",
      headers: {
        apikey: KEY, authorization: `Bearer ${KEY}`,
        "content-type": "application/json", prefer: "return=minimal",
      },
      body: JSON.stringify({ cover_resource_id: id }),
    },
  );
  if (res.ok) courseCovers++;
}

const advancedCoachingId = await findResource("advanced-coaching-sessions.jpg");
if (advancedCoachingId) {
  const res = await fetch(
    `${URL_BASE}/rest/v1/private_coaching_services?slug=eq.advanced-one-to-one&cover_resource_id=is.null`,
    {
      method: "PATCH",
      headers: {
        apikey: KEY, authorization: `Bearer ${KEY}`,
        "content-type": "application/json", prefer: "return=minimal",
      },
      body: JSON.stringify({ cover_resource_id: advancedCoachingId }),
    },
  );
  if (res.ok) courseCovers++;
}

console.log(`\nuploaded ${uploaded}  catalogued ${rows.length}  team photos ${linked}  covers ${covers}  course/coaching covers ${courseCovers}  duplicate/unsupported ${skipped}  too big ${tooBig}  failed ${failed}`);
