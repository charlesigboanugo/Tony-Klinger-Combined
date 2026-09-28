/**
 * Human labels for devices — account security (migration 0022).
 *
 * Used on both sides: the browser names a new security key after itself, and
 * the server labels signed-in sessions from their stored user agent.
 *
 * What a WEBSITE can know is less than an app can. A native app reads the
 * phone's model and the name its owner gave it; a browser reveals:
 *
 *   iPhone / iPad   the iOS version only — Apple never exposes the model
 *   Android         the version, and on Chrome/Edge the MODEL ("Pixel 8",
 *                   "SM-S918B") through User-Agent Client Hints
 *   Windows / Mac   the platform, and on Chrome/Edge its real version
 *                   (Windows 10 vs 11, macOS 15) through the same hints
 *
 * The hints are requested by `proxy.ts` (Accept-CH) and appended to the user
 * agent we forward to Supabase Auth as `TKModel/…` and `TKPlatformVersion/…`,
 * so the stored session carries them (lib/supabase/forwarded.ts).
 */
export type DeviceDescription = {
  /** What the device is: "Pixel 8", "iPhone · iOS 18", "Windows 11". */
  device: string;
  /** The browser, when known: "Chrome". */
  browser: string | null;
  /** Phone or tablet, for the icon. */
  mobile: boolean;
  /** One line: "Pixel 8 · Chrome". */
  label: string;
};

/** Samsung reports model codes; the common families read better by name. */
const SAMSUNG: Array<[RegExp, string]> = [
  [/^SM-S9[0-9]{2}/, "Galaxy S"],
  [/^SM-G9[0-9]{2}/, "Galaxy S"],
  [/^SM-A[0-9]{3}/, "Galaxy A"],
  [/^SM-F9[0-9]{2}/, "Galaxy Z Fold"],
  [/^SM-F7[0-9]{2}/, "Galaxy Z Flip"],
  [/^SM-N9[0-9]{2}/, "Galaxy Note"],
  [/^SM-X[0-9]{3}|^SM-T[0-9]{3}/, "Galaxy Tab"],
];

function friendlyModel(model: string): string {
  const family = SAMSUNG.find(([re]) => re.test(model))?.[1];
  return family ? `Samsung ${family} (${model})` : model;
}

function decode(value: string | undefined) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return value.trim() || null;
  }
}

export function describeDevice(ua: string | null | undefined): DeviceDescription {
  // Sessions created before the visitor's details were forwarded were recorded
  // with the SERVER's user agent — say so rather than pretend to know.
  if (!ua || /^node$|^undici|^Next\.js/i.test(ua.trim())) {
    return { device: "Device not recorded", browser: null, mobile: false, label: "Device not recorded" };
  }

  const model = decode(ua.match(/TKModel\/(\S+)/)?.[1]);
  const platformVersion = decode(ua.match(/TKPlatformVersion\/(\S+)/)?.[1]);
  const major = platformVersion ? Number.parseInt(platformVersion, 10) : NaN;

  // Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari".
  const browser = /Edg(A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;

  let device: string;
  let mobile = false;

  const ios = ua.match(/(iPhone|iPad)[^)]*?OS (\d+)[_.]/);
  const android = ua.match(/Android (\d+)/);

  if (ios) {
    mobile = true;
    device = `${ios[1]} · iOS ${ios[2]}`;
  } else if (/iPhone|iPad/.test(ua)) {
    mobile = true;
    device = /iPad/.test(ua) ? "iPad" : "iPhone";
  } else if (android || /Android/.test(ua)) {
    mobile = true;
    // Chrome's reduced user agent says "K" in place of the model; only the
    // client hint carries the real one.
    device = model && model !== "K" ? friendlyModel(model) : android ? `Android ${android[1]} phone` : "Android phone";
  } else if (/Windows/.test(ua)) {
    // Client hints: platform version 13+ is Windows 11, 1–12 is Windows 10.
    device = Number.isFinite(major) ? (major >= 13 ? "Windows 11" : major > 0 ? "Windows 10" : "Windows") : "Windows";
    device += " computer";
  } else if (/Mac OS X|Macintosh/.test(ua)) {
    // The user agent is frozen at 10.15; the hint has the real version.
    device = Number.isFinite(major) && major >= 11 ? `Mac · macOS ${major}` : "Mac";
  } else if (/CrOS/.test(ua)) {
    device = "Chromebook";
  } else if (/Linux/.test(ua)) {
    device = "Linux computer";
  } else {
    device = "Unrecognised device";
  }

  return { device, browser, mobile, label: browser ? `${device} · ${browser}` : device };
}

/** One-line label — kept for callers that only need text. */
export function describeUserAgent(ua: string | null | undefined): string {
  return describeDevice(ua).label;
}

/**
 * Where a passkey or security key lives, from its AAGUID — the model id the
 * authenticator reports itself at registration. A zero or unknown id says
 * nothing, and is shown as a plain "Security key" rather than guessed at.
 * Source: the community passkey-authenticator AAGUID list.
 */
const AAGUIDS: Record<string, string> = {
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "iCloud Keychain",
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "iCloud Keychain",
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google Password Manager",
  "adce0002-35bc-c60a-648b-0b25f1f05503": "Chrome on Mac",
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "Windows Hello",
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "Windows Hello",
  "bada5566-a7aa-401f-bd96-45619a55120d": "1Password",
  "d548826e-79b4-db40-a3d8-11116f7e8349": "Bitwarden",
  "531126d6-e717-415c-9320-3d9aa6981239": "Dashlane",
  "b84e4048-15dc-4dd0-8640-f4f60813c8af": "NordPass",
  "53414d53-554e-4700-0000-000000000000": "Samsung Pass",
  "cb69481e-8ff7-4039-93ec-0a2729a154a8": "YubiKey 5",
  "ee882879-721c-4913-9775-3dfcce97072a": "YubiKey 5 NFC",
  "fa2b99dc-9e39-4257-8f92-4a30d23c4118": "YubiKey 5 NFC",
  "2fc0579f-8113-47ea-b116-bb5a8db9202a": "YubiKey 5 NFC",
};

export function describeAuthenticator(aaguid: string | null | undefined): string | null {
  if (!aaguid) return null;
  return AAGUIDS[aaguid.toLowerCase()] ?? null;
}

/** "5 minutes ago", "3 days ago" — for last-used and last-active times. */
export function timeAgo(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000], ["month", 2_592_000], ["week", 604_800],
    ["day", 86_400], ["hour", 3_600], ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
