import cinemaCameraBw from "@/assets/images/cinema-camera-bw.webp";
import extra08b496ca from "@/assets/images/extra-08b496ca.webp";
import extra10ab813f from "@/assets/images/extra-10ab813f.webp";
import extra23b3b03e from "@/assets/images/extra-23b3b03e.webp";
import extra77a66a05 from "@/assets/images/extra-77a66a05.webp";
import extra84c22937 from "@/assets/images/extra-84c22937.webp";
import extra8b67cc2b from "@/assets/images/extra-8b67cc2b.webp";
import extra9af9b2df from "@/assets/images/extra-9af9b2df.webp";
import extraA3f3b1e6 from "@/assets/images/extra-a3f3b1e6.webp";
import extraA791c80e from "@/assets/images/extra-a791c80e.webp";
import extraD64ac0c2 from "@/assets/images/extra-d64ac0c2.webp";
import extraEd28353c from "@/assets/images/extra-ed28353c.webp";
import extraFe79e111 from "@/assets/images/extra-fe79e111.webp";
import talkConversation from "@/assets/images/talk-conversation.webp";
import talkGroupStanding from "@/assets/images/talk-group-standing.webp";
import talkSmallGroup from "@/assets/images/talk-small-group.webp";
import tkDc01 from "@/assets/images/tk-dc-0-1.webp";
import tkDc014 from "@/assets/images/tk-dc-0-14.webp";
import tkDc015 from "@/assets/images/tk-dc-0-15.webp";
import tkDc017 from "@/assets/images/tk-dc-0-17.webp";
import tkDc019 from "@/assets/images/tk-dc-0-19.webp";
import tkDc021 from "@/assets/images/tk-dc-0-21.webp";
import tkDc022 from "@/assets/images/tk-dc-0-22.webp";
import tkDc023 from "@/assets/images/tk-dc-0-23.webp";
import tkDc024 from "@/assets/images/tk-dc-0-24.webp";
import tkDc025 from "@/assets/images/tk-dc-0-25.webp";
import tkDc026 from "@/assets/images/tk-dc-0-26.webp";
import tkDc027 from "@/assets/images/tk-dc-0-27.webp";
import tkDc032 from "@/assets/images/tk-dc-0-32.webp";
import tkDc033 from "@/assets/images/tk-dc-0-33.webp";
import tkDc034 from "@/assets/images/tk-dc-0-34.webp";
import tkDc07 from "@/assets/images/tk-dc-0-7.webp";
import tkDc08 from "@/assets/images/tk-dc-0-8.webp";
import tynesideQa from "@/assets/images/tyneside-qa.webp";

/**
 * Every design photo, imported so the build fingerprints it — note 08 §60.1.2.
 *
 * An imported image is published as `/_next/static/media/<name>.<hash>.webp`,
 * the hash taken from the file's contents. Replacing a photo therefore gives it
 * a new URL by itself, so the optimised copies can be cached for the full 31
 * days (`minimumCacheTTL` in next.config.ts) without ever serving a stale
 * frame. A fixed `public/` path could not promise that.
 *
 * Keyed by the file name without its extension, so placements
 * (`design-photos.ts`) and credits (`photo-credits.ts`) name a photo the same
 * way and a typo is a type error rather than a broken image.
 *
 * To add a photo: drop the file in `src/assets/images/` and add it here.
 */
export const photos = {
  "cinema-camera-bw": cinemaCameraBw.src,
  "extra-08b496ca": extra08b496ca.src,
  "extra-10ab813f": extra10ab813f.src,
  "extra-23b3b03e": extra23b3b03e.src,
  "extra-77a66a05": extra77a66a05.src,
  "extra-84c22937": extra84c22937.src,
  "extra-8b67cc2b": extra8b67cc2b.src,
  "extra-9af9b2df": extra9af9b2df.src,
  "extra-a3f3b1e6": extraA3f3b1e6.src,
  "extra-a791c80e": extraA791c80e.src,
  "extra-d64ac0c2": extraD64ac0c2.src,
  "extra-ed28353c": extraEd28353c.src,
  "extra-fe79e111": extraFe79e111.src,
  "talk-conversation": talkConversation.src,
  "talk-group-standing": talkGroupStanding.src,
  "talk-small-group": talkSmallGroup.src,
  "tk-dc-0-1": tkDc01.src,
  "tk-dc-0-14": tkDc014.src,
  "tk-dc-0-15": tkDc015.src,
  "tk-dc-0-17": tkDc017.src,
  "tk-dc-0-19": tkDc019.src,
  "tk-dc-0-21": tkDc021.src,
  "tk-dc-0-22": tkDc022.src,
  "tk-dc-0-23": tkDc023.src,
  "tk-dc-0-24": tkDc024.src,
  "tk-dc-0-25": tkDc025.src,
  "tk-dc-0-26": tkDc026.src,
  "tk-dc-0-27": tkDc027.src,
  "tk-dc-0-32": tkDc032.src,
  "tk-dc-0-33": tkDc033.src,
  "tk-dc-0-34": tkDc034.src,
  "tk-dc-0-7": tkDc07.src,
  "tk-dc-0-8": tkDc08.src,
  "tyneside-qa": tynesideQa.src,
} as const;

export type PhotoName = keyof typeof photos;
