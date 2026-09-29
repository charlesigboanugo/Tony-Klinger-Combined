// Convert already-stored AVIF images to WebP, in place — note 10 §47.3.
//
//   node scripts/convert-stored-avif.mjs                 # local (.env.local)
//   node scripts/convert-stored-avif.mjs --env <file>    # another project
//
// Next's image optimizer (and Vercel's) never resizes an AVIF source, so every
// stored AVIF reached phones at full size. For each `resources` row whose file
// is an .avif in site-media, this writes a WebP copy (quality 90, same
// dimensions) beside it and points the SAME row at it, so every cover, photo,
// gallery and event image that references the row follows without relinking.
//
// The AVIF files are left in storage, so this can be undone by pointing the
// rows back. Idempotent: a converted row no longer ends in .avif.
import fs from "node:fs";
import sharp from "sharp";

const argv = process.argv.slice(2);
const envFile = argv.includes("--env") ? argv[argv.indexOf("--env") + 1] : ".env.local";
const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8").split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")]),
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error(`${envFile} needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`);
const auth = { apikey: KEY, authorization: `Bearer ${KEY}` };
console.log(`target ${URL_BASE} (${envFile})`);

const res = await fetch(
  `${URL_BASE}/rest/v1/resources?select=id,storage_path&storage_path=like.site-media/*.avif&limit=10000`,
  { headers: auth },
);
const rows = await res.json();
if (!Array.isArray(rows)) throw new Error(`could not list resources: ${JSON.stringify(rows).slice(0, 200)}`);
console.log(`${rows.length} AVIF images to convert`);

const encode = (p) => p.split("/").map(encodeURIComponent).join("/");
let done = 0, failed = 0, before = 0, after = 0;

async function convert({ id, storage_path }) {
  const objectPath = storage_path.slice("site-media/".length);
  const webpPath = objectPath.replace(/\.avif$/i, ".webp");

  const src = await fetch(`${URL_BASE}/storage/v1/object/site-media/${encode(objectPath)}`, { headers: auth });
  if (!src.ok) throw new Error(`download ${src.status}`);
  const avif = Buffer.from(await src.arrayBuffer());
  const webp = await sharp(avif).webp({ quality: 90 }).toBuffer();

  const up = await fetch(`${URL_BASE}/storage/v1/object/site-media/${encode(webpPath)}`, {
    method: "POST",
    headers: { ...auth, "content-type": "image/webp", "x-upsert": "true" },
    body: webp,
  });
  if (!up.ok) throw new Error(`upload ${up.status} ${(await up.text()).slice(0, 100)}`);

  const patch = await fetch(`${URL_BASE}/rest/v1/resources?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...auth, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify({ storage_path: `site-media/${webpPath}` }),
  });
  if (!patch.ok) throw new Error(`update ${patch.status} ${(await patch.text()).slice(0, 100)}`);

  before += avif.length;
  after += webp.length;
}

// A few at a time: enough to be quick, few enough not to trip rate limits.
const queue = [...rows];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      try {
        await convert(row);
        done++;
      } catch (e) {
        failed++;
        if (failed <= 5) console.log(`  FAILED ${row.storage_path}: ${e.message}`);
      }
    }
  }),
);

const mb = (b) => (b / 1048576).toFixed(1);
console.log(`converted ${done}, failed ${failed} (stored ${mb(before)} MB AVIF -> ${mb(after)} MB WebP; phones now get resized copies)`);
