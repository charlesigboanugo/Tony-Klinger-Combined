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
import sharp from "sharp";

// Flags:
//   --env <file>   which project to write to (default .env.local). Production
//                  runs use their own env file, never .env.local.
//   --only-used    upload just the images the site references (the maps below)
//                  rather than the whole captured library. Off by default: the
//                  whole library is migrated everywhere, production included,
//                  so every image from the old sites stays available to assign.
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const envFile = flag("--env") ? argv[argv.indexOf("--env") + 1] : ".env.local";

const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8").split("\n")
    .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error(`${envFile} needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`);

const ONLY_USED = flag("--only-used");
console.log(`target ${URL_BASE} (${envFile}) — ${ONLY_USED ? "referenced images only" : "whole library"}`);

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

// Filenames after scripts/compress-images.mjs are `<stem>.avif`; the map records
// each one's ORIGINAL name, which is what usage data, COVERS, GALLERY etc. use.
const originalOf = new Map();   // "<site>/<folder>/<new name>" -> original name
const newNamesOf = new Map();   // sanitised original name -> [sanitised new names]
const sanitise = (n) => n.replace(/[^A-Za-z0-9._-]/g, "-");
for (const [dir] of SITES) {
  try {
    const map = JSON.parse(fs.readFileSync(`current-website/${dir}/site-files/_compression-map.json`, "utf8"));
    for (const [key, orig] of Object.entries(map)) {
      originalOf.set(`${dir}/${key}`, orig);
      const k = sanitise(orig);
      newNamesOf.set(k, [...(newNamesOf.get(k) ?? []), sanitise(key.split("/").pop())]);
    }
  } catch {}
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

  // Verified by the title legible in the artwork itself. These once sat in a
  // migration, which runs before this script uploads anything, so they never
  // took effect after a `db reset` (note 08 §60.1.1).
  "alsatia-the-search-for-treasure": "Screenshot-2024-09-05-215117.png",
  "just-a-boy": "JustABoy_pic.PNG",                      // the film's artwork, title top left
  // Not on the old sites: a CC BY-SA photograph of the INS Dakar, the submarine
  // the film is about (supabase/content/images/CREDITS.md). Credited on the page.
  "full-circle": "ins-dakar-1968.avif",
  // A trilogy of scripts with no artwork of its own. The owner chose the stock
  // image /the-havana-chronicles used for 4 Kicks (Unsplash licence: free
  // commercial use) to stand for the whole.
  "the-havana-chronicles": "luigi-estuye-lucreative-pfzr6DwKb28-unsplash.jpg",
  // Two of the poster cards along the bottom of /film, titles legible.
  "shout-at-the-devil": "p163_p_v13_af.jpg",             // "A Michael Klinger Production"
  // The /film card's file is a byte-identical copy of this one, which is the
  // copy the upload keeps.
  "the-butterfly-ball": "MV5BMjA0ODY2ODkxNl5BMl5BanBnXkFtZTcwNTM1MDIzMQ__._V1_.jpg", // "A film by Tony Klinger"
  // One book with its sister title inside (owner, 2026-09-25) — this jacket is
  // the book's. How to Get Your Movie Made no longer has an entry of its own,
  // so its separate jacket is not used.
  "how-to-get-into-the-movie-business": "Screenshot-2024-09-05-221742.png",

  // Podcasts and interviews (2026-09-25). The old /interviews page's own
  // images where it had one for the entry, each placed by its position among
  // the page's section headings and checked by eye: the Sod's Law episode
  // artwork, the caricature of Tony in the Southeast Media section, the Look
  // Back Machine logo, and a signed Kirk Douglas portrait from Tony's library
  // for the Danny Kelly interview about Douglas's death.
  "the-sods-law-podcast": "67987d_28a4456f63d74d41a8098b7198cf64fa~mv2.jpg",
  "southeast-media-podcasts": "67987d_85af3cfb4f9a4865bf5cc6518006c439~mv2.png",
  "the-look-back-machine-podcast": "67987d_a20071b5c7ed43c1bf075fbd9a95339a~mv2.jpg",
  "bbc-radio-birmingham-danny-kelly": "Kirk_douglas_photo_signed.jpg",
  // The rest had no usable image on the old site; each is the show's or the
  // platform's own artwork (supabase/content/images/CREDITS.md).
  "the-tony-klinger-podcast": "the-tony-klinger-podcast-cover.avif",
  "follow-your-dream-podcast": "follow-your-dream-podcast-cover.avif",
  "waffleon-podcast": "waffle-on-podcast-cover.avif",
  "the-audio-ade-memoire-podcast": "audio-ade-memoire-podcast-cover.avif",
  "this-is-happening-podcast": "this-is-happening-podcast-cover.avif",
  "starlight-broadcasting": "starlight-broadcasting-cover.avif",
  "the-douglas-coleman-show": "douglas-coleman-show-cover.avif",
  "hope-fm": "hope-fm-cover.avif",
  "soul-radio-usa-spotlight-on": "soul-radio-usa-cover.avif",
  "talkradio-james-whale": "james-whale-show-talkradio-cover.avif",
  "worlds-most-amazing-people": "wmap-radio-cover.avif",
  // Audio: the audiobook's own square cover, not the book jacket again — it is
  // a different edition, and the jacket already covers the book's own card.
  "the-butterfly-boy-audiobook": "the-butterfly-boy-audiobook-cover.avif",
  // Watch, and the video interviews from Tony's YouTube channel: each video's
  // own thumbnail (supabase/content/08_watch_and_video_interviews.sql).
  "lights-chutzpah-action": "lights-chutzpah-action-cover.avif",
  "sisters-trailer": "sisters-trailer-cover.avif",
  "tony-klinger-speaks": "tony-klinger-speaks-cover.avif",
  "bbc-radio-london-robert-elms": "bbc-radio-london-robert-elms-cover.avif",
  "bbc-radio-northampton-bernie-keith": "bbc-radio-northampton-bernie-keith-2026-cover.avif",
  "bbc-radio-newcastle-kelly-scott": "bbc-radio-newcastle-kelly-scott-cover.avif",
  "bernie-keith-show-get-carter": "bbc-radio-northampton-bernie-keith-get-carter-cover.avif",
  "bbc-radio-northampton-akylah-rodriguez": "bbc-radio-northampton-akylah-rodriguez-cover.avif",
  "screen-northants-tv-interview": "screen-northants-tv-interview-cover.avif",
  // The rest of /watch (supabase/content/09_watch_uploads_pending.sql): each
  // video's own cover from the old site's Wix video channel. Most of these
  // entries are drafts until their uploads have links; the cover is ready.
  "dc-video-promo": "dc-video-promo-cover.avif",
  "tony-klinger-public-speaking": "tony-klinger-public-speaking-cover.avif",
  "the-man-who-got-carter-teaser": "the-man-who-got-carter-teaser-cover.avif",
  "navegator-promo": "navegator-promo-cover.avif",
  "festival-game-introduction": "festival-game-introduction-cover.avif",
  "butterfly-boy-introduction": "butterfly-boy-introduction-cover.avif",
  "give-get-go-video": "give-get-go-video-cover.avif",
  "ggg-one": "ggg-one-cover.avif",
  "ggg-two": "ggg-two-cover.avif",
  "ggg-three": "ggg-three-cover.avif",
  "romford-film-festival-qa": "romford-film-festival-interview-cover.avif",
  // Interviews identified from the capture's untitled recordings (10_*.sql).
  // The premiere Q&A: the photo the old site's news archive placed beside
  // that recording — the Q&A itself, on stage at the Premiere Cinema. The
  // George Wilder Jr. Show uses the show's own artwork from its BlogTalkRadio
  // page — gone from the live web, recovered from the Internet Archive.
  "the-man-who-got-carter-premiere-qa": "man-who-got-carter-premiere-qa-cover.avif",
  "the-george-wilder-jr-show": "george-wilder-jr-show-cover.avif",
  "solo2darwin": "Screenshot-2024-09-05-220917.png",
  "dirty-sexy-and-totally-iconic": "MV5BYjJmZDdjNmMtOGY5MS00ODM5LThhZDItMmRlMmE1YWJhMWEyXkEyXkFqcGdeQXVyMzY3OTgyODA_._V1_.jpg",
};

// Further images of a work, shown as a gallery on its own page beneath the
// cover. Each was opened and looked at, and each is an image that site itself
// placed with that work — on the work's own page or in its section of /film.
// Candidates the owner rejected as not the work's images (an earlier yellow
// cover draft, an untitled painting, an audiobook sleeve, a narrator portrait)
// stay out, and so does anything that repeats the cover: a gallery adds
// images, it does not show the cover again in another frame. (Who Knows' two
// colourways are the exception the owner chose to keep.)
const GALLERY = {
  // Same promo in other colourways, then the first-edition jacket: the book was
  // first published as Twilight of the Gods (owner, 2026-09-25). That file is
  // TwlightBook_pic.PNG with its white margins trimmed (supabase/content/images):
  // a portrait jacket on a wide white ground, which untrimmed read as landscape.
  "who-knows-making-of-a-rock-movie": ["1.png", "3.png", "twilight-of-the-gods-cover.avif"],
  "the-butterfly-boy": ["coverthumb.webp"],               // alternate jacket
  // Films, from the 2026-09-23 sweep of every page on tonydklinger.com.
  // The illustration on the film's own page. Its file there is a byte-identical
  // copy of SleepingItOff.PNG, which is the copy the upload keeps. (That file
  // was once wrongly made this film's COVER; as its page illustration it is right.)
  "the-kids-are-alright": ["SleepingItOff.PNG"],
  "the-man-who-got-carter": ["OPT 2.png", "Chichester_fest.jpg"],  // Give-Get-Go poster; Chichester 2019 festival poster
  // Not from the old sites: openly licensed photographs of the INS Dakar, the
  // film's subject (supabase/content/images/CREDITS.md). Credited on the page.
  "full-circle": ["ins-dakar-last-photograph-1968.avif", "ins-dakar-emblem.avif"],
  "sisters": ["IMG-20211020-WA0000.jpg"], // Houses of Parliament screening
  "solo2darwin": ["RouteMap.JPG", "Logo1.JPG", "amanda.JPG", "trio2.JPG", "trio.JPG"], // route, squadron badge, Amanda and the team at Duxford
  // STOCK PHOTOGRAPHS, knowingly: /the-havana-chronicles illustrates each of
  // its three stories with one. The Unsplash one (4 Kicks) is the cover, by the
  // owner's choice; the two pxfuel ones (Honeysuckle Heights, Closed Circuit)
  // are the gallery, in story order.
  "the-havana-chronicles": ["pxfuel.com (3).jpg", "pxfuel.com (1).jpg"],
};

// Course and private-coaching covers, verified the same way as the catalogue
// ones above. They live HERE, not in a migration: migrations run before this
// script uploads anything, so a migration's match against `resources` finds
// an empty table on every fresh reset (note 08 §60.1.1).
//
// PHOTOGRAPHS OF THE SUBJECT, NOT TITLE CARDS (owner, 2026-09-26: each product
// needs "a fine image as cover that depicts what it is about"). The old sites'
// covers for these were typographic ("Level 1", "Advanced Coaching Sessions")
// and the series, cohorts and retreat had none. These are CC0 photographs from
// StockSnap, found through Openverse (supabase/content/images/CREDITS.md).
const COURSE_COVERS = {
  "level-one": "coaching-level-one-cover.avif",
  "level-two": "coaching-level-two-cover.avif",
  "level-three": "coaching-level-three-cover.avif",
};
const ADVANCED_COACHING_COVER = "coaching-private-cover.avif";
// Keyed by table, then slug. Set only where no cover is chosen yet, like the
// course covers, so a cover picked in Admin survives a re-run.
const PRODUCT_COVERS = {
  group_coaching_series: {
    "filmmaking": "coaching-filmmaking-cover.avif",
    "writing": "coaching-writing-cover.avif",
    "producing": "coaching-producing-cover.avif",
    "for-all-filmmakers": "coaching-for-all-filmmakers-cover.avif",
  },
  cohorts: {
    "cohort-silver": "coaching-cohort-silver-cover.avif",
    "cohort-gold": "coaching-cohort-gold-cover.avif",
    "cohort-platinum": "coaching-cohort-platinum-cover.avif",
  },
  retreats: {
    "virtual-retreat": "coaching-virtual-retreat-cover.avif",
  },
};

// Filmed testimonials (supabase/content/11_testimonial_videos.sql): each
// video's own cover frame from the coaching site's Wix video gallery.
const TESTIMONIAL_VIDEO_COVERS = {
  "sen-monro-short": "testimonial-sen-monro-short-cover.avif",
  "sharon-touviano-short": "testimonial-sharon-touviano-short-cover.avif",
  "phil-miller-short": "testimonial-phil-miller-short-cover.avif",
  "paul-greenwood": "testimonial-paul-greenwood-cover.avif",
  "compilation": "testimonial-compilation-cover.avif",
  "sharon": "testimonial-sharon-cover.avif",
  "sen": "testimonial-sen-cover.avif",
  "amanda": "testimonial-amanda-cover.avif",
  "francesca": "testimonial-francesca-cover.avif",
  "josh": "testimonial-josh-cover.avif",
  "phil": "testimonial-phil-cover.avif",
};


// Every image a page actually shows, by ORIGINAL (pre-compression) filename.
// With --only-used, nothing outside this set is uploaded.
const USED = new Set([
  ...Object.values(TEAM_PHOTOS),
  ...Object.values(COVERS),
  ...Object.values(GALLERY).flat(),
  ...Object.values(COURSE_COVERS),
  ...Object.values(PRODUCT_COVERS).flatMap((m) => Object.values(m)),
  ...Object.values(TESTIMONIAL_VIDEO_COVERS),
  ADVANCED_COACHING_COVER,
].map(sanitise));

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
// Every folder to upload: both folders of each old site, then the images
// added from outside them (supabase/content/images — committed, and credited
// in its CREDITS.md, because unlike the old sites' media it lives in the repo).
// Credit shown with each image (migration 0012), in Tony Klinger's wording
// (2026-09-24). It goes ONLY where the old sites themselves gave it (owner,
// 2026-09-26): tonydklinger.com's home page credits "Photos of Tony Klinger
// courtesy of Danny Clifford", and the coaching site's hero "Photo Credits:
// Danny Clifford" — both beside portraits from one shoot of Tony, whose files
// are the camera's own frame names (Z91_…, Z92_…) plus the one the crawler
// saved under its Wix id. Book jackets, posters, stills and everything else
// carry no credit unless one is known below — none is better than a wrong one.
// Images added from elsewhere keep the credit their licence requires instead
// (supabase/content/images/CREDITS.md).
const SUPPLIED_CREDIT = "Photos courtesy of Danny Clifford Photographer";
const CLIFFORD_SHOOT = /^(Z9[12]_\d+(-Edit)?|9388fb_4dcc5d4200784ffb998a6d66782d98b8~mv2)\.[a-z]+$/i;
// Old-site files whose own credit is known. Keyed by original filename.
const SOURCE_CREDIT_OVERRIDES = {
  "67987d_28a4456f63d74d41a8098b7198cf64fa~mv2.jpg": "Artwork: The Sod's Law Podcast",
  "67987d_85af3cfb4f9a4865bf5cc6518006c439~mv2.png": null, // Southeast Media caricature — artist unknown
  "67987d_a20071b5c7ed43c1bf075fbd9a95339a~mv2.jpg": "Logo: The Look Back Machine Podcast",
  "Kirk_douglas_photo_signed.jpg": null, // a studio publicity portrait, not Danny Clifford's
  "tmwgc title.jpg": null, // a title graphic, not a photograph
};
const CONTENT_CREDITS = {
  "ins-dakar-1968.avif": "Photo: Bamahane photographer (Israel Defense Forces), via Wikimedia Commons, CC BY-SA 3.0",
  "ins-dakar-last-photograph-1968.avif": "Photo: Clandestine Immigration and Naval Museum, via Wikimedia Commons, CC0",
  "ins-dakar-emblem.avif": "Emblem: Israel Defense Forces, via Wikimedia Commons, CC BY-SA 3.0",
  // The old site's own jacket image, trimmed of its margins. A jacket, not a
  // Clifford photograph, so no credit.
  "twilight-of-the-gods-cover.avif": null,
  // Show artwork for podcasts and interviews: not openly licensed — each is
  // the show's own promotional image, used to identify it, credited to it.
  "the-tony-klinger-podcast-cover.avif": null,
  "follow-your-dream-podcast-cover.avif": "Artwork: Follow Your Dream Podcast",
  "waffle-on-podcast-cover.avif": "Artwork: Waffle On Podcast",
  "audio-ade-memoire-podcast-cover.avif": "Artwork: The audio Ade-Memoire",
  "this-is-happening-podcast-cover.avif": "Artwork: This Is Happening! podcast",
  "starlight-broadcasting-cover.avif": "Image: Starlight Broadcasting",
  "douglas-coleman-show-cover.avif": "Artwork: The Douglas Coleman Show",
  "hope-fm-cover.avif": "Logo: Hope FM",
  "soul-radio-usa-cover.avif": "Logo: Soul Radio USA",
  "james-whale-show-talkradio-cover.avif": "Artwork: The James Whale Show, talkRADIO",
  "wmap-radio-cover.avif": "Artwork: KC Armstrong's WMAP Radio",
  "the-butterfly-boy-audiobook-cover.avif": "Cover: Oak Tree Press / Andrews UK",
  // Thumbnails from Tony's own channel carry no credit; the Sisters trailer's
  // comes from the film's own channel and is credited to it.
  "george-wilder-jr-show-cover.avif": "Artwork: The George Wilder Jr. Show",
  "sisters-trailer-cover.avif": "Image: Sisters trailer, Peace Beats with Dan Blackwell",
  "dc-video-promo-cover.avif": "Image: David Courtney Music",
};

const SOURCES = [
  ...SITES.flatMap(([dir, label]) =>
    ["images", "images-from-web"].map((folder) => ({ dir, label, folder, base: `current-website/${dir}/site-files/${folder}` })),
  ),
  { dir: "content", label: "content", folder: "images", base: "supabase/content/images" },
];

for (const { dir, label, folder, base } of SOURCES) {
  if (!fs.existsSync(base)) continue;

  for (const name of fs.readdirSync(base)) {
    const full = path.join(base, name);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;

    const logical = originalOf.get(`${dir}/${folder}/${name}`) ?? name;
    if (ONLY_USED && !USED.has(sanitise(logical))) continue;
    const ext = path.extname(name).toLowerCase();
    const type = MIME[ext];
    if (!type) { skipped++; continue; }
    if (stat.size > MAX) { tooBig++; console.log(`  TOO BIG (${(stat.size/1048576).toFixed(1)}MB) ${name}`); continue; }

    const bytes = fs.readFileSync(full);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    if (seen.has(hash)) { skipped++; continue; }

    // Flat: a hash-prefixed filename is unique on its own (the sources contain
    // same-named files), so no per-site folders. Which page an image appeared on
    // is recorded in resources.title, not in the path.
    const safe = name.replace(/[^A-Za-z0-9._-]/g, "-");
    const objectPath = `${hash.slice(0, 8)}-${safe}`;

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
    const pages = (usage[logical] ?? []).map((u) => u.page);
    // The artwork's shape drives the catalogue layout (migration 0011), so it
    // is read from the file here, once, rather than at every render.
    // An unreadable or empty file has no shape; it still uploads, as before.
    let width, height;
    try {
      ({ width, height } = await sharp(bytes).metadata());
    } catch {}
    const credit =
      label === "content"
        ? (CONTENT_CREDITS[name] ?? null)
        : logical in SOURCE_CREDIT_OVERRIDES
          ? SOURCE_CREDIT_OVERRIDES[logical]
          : CLIFFORD_SHOOT.test(logical)
            ? SUPPLIED_CREDIT
            : null;
    rows.push({ path: objectPath, name: logical, label, pages, width, height, credit });
  }
}

// Catalogue what was uploaded. `supabase db reset` wipes storage.objects AND
// the resources table, so this script is the repeatable path back to a
// populated local environment — seed.sql cannot upload files.
if (rows.length > 0) {
  const records = rows.map((r) => {
    const pages = [...new Set(r.pages)].sort().join(", ");
    const title = (pages ? `${r.name} — used on ${pages}` : r.name).slice(0, 200);
    return { title, resource_type: "image", storage_path: `site-media/${r.path}`, width: r.width ?? null, height: r.height ?? null, credit: r.credit };
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
        // Merge, not ignore: a re-run fills in dimensions on rows catalogued
        // before they were recorded. The content-hashed path never changes.
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(records.slice(i, i + 100)),
    });
    if (!res.ok) console.log(`  catalogue chunk ${i} failed: ${res.status} ${(await res.text()).slice(0, 140)}`);
  }
}

// Names are sanitised on upload (line ~64), so a COVERS key written as it
// appears on disk — "SISTERS Poster.png" — never matches the stored
// "SISTERS-Poster.png". Sanitise here too, so both spellings work.
//
// The match is anchored on the "/<8-char hash>-" prefix every upload carries.
// A bare "*-2.png" also matched "OPT-2.png", so a numbered filename could have
// resolved to an unrelated image. More than one hit is reported, not guessed.
const findResource = async (file) => {
  // A file keyed by its original name may now be stored under its converted one.
  const candidates = [...new Set([...(newNamesOf.get(sanitise(file)) ?? []), sanitise(file)])];
  for (const candidate of candidates) {
    const res = await fetch(
      `${URL_BASE}/rest/v1/resources?select=id,storage_path&storage_path=like.*/________-${encodeURIComponent(candidate)}&limit=2`,
      { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } },
    );
    const rows = await res.json().catch(() => []);
    if (rows.length > 1) {
      console.log(`  AMBIGUOUS: ${file} -> ${rows.map((r) => r.storage_path).join(", ")}`);
      return null;
    }
    if (rows[0]) return rows[0].id;
  }
  return null;
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

let galleryImages = 0;
for (const [slug, files] of Object.entries(GALLERY)) {
  const itemRes = await fetch(
    `${URL_BASE}/rest/v1/catalogue_items?select=id&slug=eq.${slug}&limit=1`,
    { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } },
  );
  const [item] = await itemRes.json().catch(() => []);
  if (!item) { console.log(`  GALLERY ITEM NOT FOUND: ${slug}`); continue; }

  for (const [i, file] of files.entries()) {
    const id = await findResource(file);
    if (!id) { console.log(`  GALLERY IMAGE NOT FOUND: ${slug} -> ${file}`); continue; }
    const res = await fetch(`${URL_BASE}/rest/v1/catalogue_item_resources`, {
      method: "POST",
      headers: {
        apikey: KEY, authorization: `Bearer ${KEY}`,
        "content-type": "application/json",
        // Re-runs update the position rather than failing on the primary key.
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ catalogue_item_id: item.id, resource_id: id, position: (i + 1) * 10 }),
    });
    if (res.ok) galleryImages++;
  }
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

const advancedCoachingId = await findResource(ADVANCED_COACHING_COVER);
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

for (const [table, bySlug] of Object.entries(PRODUCT_COVERS)) {
  for (const [slug, file] of Object.entries(bySlug)) {
    const id = await findResource(file);
    if (!id) { console.log(`  PRODUCT COVER NOT FOUND: ${table}/${slug} -> ${file}`); continue; }
    const res = await fetch(`${URL_BASE}/rest/v1/${table}?slug=eq.${slug}&cover_resource_id=is.null`, {
      method: "PATCH",
      headers: {
        apikey: KEY, authorization: `Bearer ${KEY}`,
        "content-type": "application/json", prefer: "return=minimal",
      },
      body: JSON.stringify({ cover_resource_id: id }),
    });
    if (res.ok) courseCovers++;
  }
}

let videoCovers = 0;
for (const [slug, file] of Object.entries(TESTIMONIAL_VIDEO_COVERS)) {
  const id = await findResource(file);
  if (!id) { console.log(`  TESTIMONIAL COVER NOT FOUND: ${slug} -> ${file}`); continue; }
  const res = await fetch(`${URL_BASE}/rest/v1/testimonial_videos?slug=eq.${slug}`, {
    method: "PATCH",
    headers: {
      apikey: KEY, authorization: `Bearer ${KEY}`,
      "content-type": "application/json", prefer: "return=minimal",
    },
    body: JSON.stringify({ cover_resource_id: id }),
  });
  if (res.ok) videoCovers++;
}

console.log(`\nuploaded ${uploaded}  catalogued ${rows.length}  team photos ${linked}  covers ${covers}  gallery ${galleryImages}  course/coaching covers ${courseCovers}  testimonial video covers ${videoCovers}  duplicate/unsupported ${skipped}  too big ${tooBig}  failed ${failed}`);
