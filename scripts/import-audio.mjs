// Uploads the catalogue's hosted recordings to Supabase Storage and attaches
// them to their works — note 08 §60.1 (public audio lives in site-media).
//
// Separate from import-images.mjs on purpose: images are uploaded as a whole
// library and assigned by hand afterwards; audio is a short, explicit list,
// every file named against the work it belongs to. Nothing is uploaded that
// no work uses.
//
// Each recording becomes a `resources` row (resource_type 'audio') joined to
// its work through `catalogue_item_resources`, in play order — the same join
// the gallery uses, which the gallery query filters to images. A work with two
// parts simply has two rows.
//
// Idempotent: the object path carries a content hash, uploads upsert, the
// resource row merges on storage_path and the join row on its primary key.
//
//   node scripts/import-audio.mjs                 # local (.env.local)
//   node scripts/import-audio.mjs --env <file>    # another project
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const argv = process.argv.slice(2);
const envFile = argv.includes("--env") ? argv[argv.indexOf("--env") + 1] : ".env.local";
const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8").split("\n")
    .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error(`${envFile} needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`);

const BASE = "current-website/tonydklinger.com/site-files/audio";

/**
 * Work (category/slug) → its recordings, in play order, each with the title a
 * listener sees. Every file here was matched to its entry on the old
 * /interviews page by the player caption beside it.
 */
const AUDIO = {
  "podcasts/southeast-media-podcasts": [
    ["Tony-Klinger.mp3", "Southeast Media Podcasts — Tony Klinger"],
  ],
  "podcasts/the-look-back-machine-podcast": [
    ["Tony Klinger and Vincent Price Full.mp3", "Tony Klinger and Vincent Price"],
  ],
  "podcasts/the-audio-ade-memoire-podcast": [
    ["TMWGC_AdeInterview.mp3", "The Audio Ade-Memoire — The Man Who Got Carter"],
  ],
  "interviews/bbc-radio-birmingham-danny-kelly": [
    ["BBC Radio Birmingham Tony Klinger on Danny Kelly 6 2 20 Part 1.mp3", "Part 1"],
    ["BBC Radio Birmingham Tony Klinger on Danny Kelly 6 2 20 Part 2.mp3", "Part 2"],
  ],
  "interviews/the-douglas-coleman-show": [
    ["The Douglas Coleman Show Tony Klinger Interview.mp3", "The Douglas Coleman Show"],
  ],
  "interviews/hope-fm": [["HopeRadio_Int.mp3", "Hope FM — Deborah Fennella and Tony C Gough"]],
  // The full interview, then the topic segments the old page played beneath
  // it, in its order — each cut from the full recording.
  "interviews/soul-radio-usa-spotlight-on": [
    ["SoulRadio_Full.mp3", "The full interview"],
    ["SoulRadio_Extremes.mp3", "Extremes"],
    ["SoulRadio_ButterlyBall.mp3", "The Butterfly Ball"],
    ["SoulRadio_TheKids.mp3", "The Kids Are Alright"],
    ["SoulRadio_GetCarter.mp3", "Get Carter"],
    ["SoulRadio_TMWGC.mp3", "The Man Who Got Carter"],
    ["SoulRadio_TSMGO.mp3", "The Show Must Go On"],
    ["SoulRadio_Q&A.mp3", "Q&A"],
    ["SoulRadio_Books.mp3", "Books"],
  ],
  "interviews/talkradio-james-whale": [["TalkRadio.mp3", "The James Whale Show — TalkRADIO"]],
  "interviews/worlds-most-amazing-people": [["WMAP_Interview.mp3", "WMAP Radio NY"]],
  // Identified 2026-09-26 by transcription (supabase/content/10_*.sql).
  "interviews/the-man-who-got-carter-premiere-qa": [
    ["Get Carter Q&A Edited.MP3", "Q&A — Romford Film Foundation"],
  ],
  "interviews/the-george-wilder-jr-show": [["GeorgeWilderJr.mp3", "The George Wilder Jr. Show"]],
};

const headers = { apikey: KEY, authorization: `Bearer ${KEY}` };
let uploaded = 0, attached = 0, missing = 0;

for (const [key, files] of Object.entries(AUDIO)) {
  const [category, slug] = key.split("/");
  const itemRes = await fetch(
    `${URL_BASE}/rest/v1/catalogue_items?select=id&category=eq.${category}&slug=eq.${slug}&limit=1`,
    { headers },
  );
  const [item] = await itemRes.json().catch(() => []);
  if (!item) { console.log(`  WORK NOT FOUND: ${key}`); missing++; continue; }

  for (const [i, [file, title]] of files.entries()) {
    const full = path.join(BASE, file);
    if (!fs.existsSync(full)) { console.log(`  FILE NOT FOUND: ${full}`); missing++; continue; }

    const bytes = fs.readFileSync(full);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    // Paths use ids, never slugs (note 08 §60.1): a content hash is the id here.
    const objectPath = `audio/${hash.slice(0, 8)}-${file.replace(/[^A-Za-z0-9._-]/g, "-").replace(/\.MP3$/, ".mp3")}`;

    const up = await fetch(`${URL_BASE}/storage/v1/object/site-media/${encodeURI(objectPath)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": "audio/mpeg", "x-upsert": "true" },
      body: bytes,
    });
    if (!up.ok) { console.log(`  UPLOAD FAILED ${file}: ${up.status} ${(await up.text()).slice(0, 140)}`); continue; }
    uploaded++;

    const resRes = await fetch(`${URL_BASE}/rest/v1/resources?on_conflict=storage_path&select=id`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({ title, resource_type: "audio", storage_path: `site-media/${objectPath}` }),
    });
    const [resource] = await resRes.json().catch(() => []);
    if (!resource) { console.log(`  RESOURCE FAILED ${file}: ${resRes.status}`); continue; }

    const link = await fetch(`${URL_BASE}/rest/v1/catalogue_item_resources`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ catalogue_item_id: item.id, resource_id: resource.id, position: (i + 1) * 10 }),
    });
    if (link.ok) attached++;
    else console.log(`  ATTACH FAILED ${file}: ${link.status} ${(await link.text()).slice(0, 140)}`);
  }
}

console.log(`\naudio: uploaded ${uploaded}  attached ${attached}  missing ${missing}`);
process.exit(missing > 0 ? 1 : 0);
