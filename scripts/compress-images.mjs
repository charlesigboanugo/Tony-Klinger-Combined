// Converts the captured site images to AVIF in place, in current-website/*/site-files/.
//
// These are Wix exports and crawler downloads: many are full camera/export
// resolution (up to 7880x5253), far beyond next.config.ts's largest breakpoint
// (1920px). Output is `<stem>.avif` — the extension is the marker that a file
// has been compressed, so there is no "-compressed" suffix.
//
// Two files in one folder can share a stem and differ only by extension
// (IMG_0106.png / IMG_0106.JPG). The second becomes `IMG_0106-2.avif`; no
// format word ever appears in a name.
//
// scripts/import-images.mjs finds covers/gallery/usage by ORIGINAL filename, so
// every conversion is recorded in site-files/_compression-map.json
// ({ "<folder>/<new name>": "<original name>" }) and the import reads it.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SITES = ["tonydklinger.com", "tonyklingercoaching.com", "tonyklingeronlinecoaching.com"];
const FOLDERS = ["images", "images-from-web"];

// Longest edge any layout can request (deviceSizes max 1920) plus headroom for
// high-DPI screens.
const MAX_EDGE = 2200;
const SOURCE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const CONCURRENCY = 4;

// Files converted by an earlier run were renamed `<stem>-compressed.<ext>`.
const originalName = (name) => name.replace(/-compressed(?=\.[^.]+$)/, "");

const mb = (n) => (n / 1048576).toFixed(1);
let converted = 0, kept = 0, failed = 0, before = 0, after = 0;
const perSite = {};

for (const site of SITES) {
  const siteRoot = `current-website/${site}/site-files`;
  const mapPath = `${siteRoot}/_compression-map.json`;
  const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : {};
  perSite[site] = { n: 0, before: 0, after: 0 };

  for (const folder of FOLDERS) {
    const base = `${siteRoot}/${folder}`;
    if (!fs.existsSync(base)) continue;

    const jobs = fs.readdirSync(base)
      .filter((n) => fs.statSync(path.join(base, n)).isFile() && SOURCE_EXT.has(path.extname(n).toLowerCase()))
      .map((n) => ({ src: n, orig: originalName(n) }));

    const stemOf = (n) => n.slice(0, -path.extname(n).length);
    // Names already taken (including by earlier outputs this run) get -2, -3, ...
    const existing = new Set(fs.readdirSync(base));

    const run = async ({ src, orig }) => {
      const stem = stemOf(orig);
      let target = `${stem}.avif`;
      for (let n = 2; existing.has(target); n++) target = `${stem}-${n}.avif`;
      existing.add(target);

      const full = path.join(base, src);
      try {
        const input = fs.readFileSync(full);
        const out = await sharp(input, { failOn: "none" })
          .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
          .avif({ quality: 65, effort: 3 })
          .toBuffer();

        // Never trade a smaller file for a larger one.
        if (out.length >= input.length) {
          if (src !== orig) fs.renameSync(full, path.join(base, orig));
          kept++;
          return;
        }

        fs.writeFileSync(path.join(base, target), out);
        fs.rmSync(full);
        map[`${folder}/${target}`] = orig;
        converted++;
        before += input.length; after += out.length;
        perSite[site].n++; perSite[site].before += input.length; perSite[site].after += out.length;
      } catch (err) {
        failed++;
        console.log(`  ERROR ${full}: ${err.message}`);
      }
    };

    let next = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) await run(jobs[next++]);
    }));
  }
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
}

console.log("\nPer site:");
for (const [site, s] of Object.entries(perSite)) console.log(`  ${site}: ${s.n} converted, ${mb(s.before)}MB -> ${mb(s.after)}MB`);
console.log(`\nconverted ${converted}  kept(avif not smaller) ${kept}  failed ${failed}`);
console.log(`total ${mb(before)}MB -> ${mb(after)}MB`);
