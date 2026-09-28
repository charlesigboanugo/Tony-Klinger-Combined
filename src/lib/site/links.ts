/**
 * Tony's own channels, in one place so the Contact page and any future footer
 * or share block read the same list.
 *
 * URLs were taken from the captured legacy sites (current-website/), not
 * guessed. `substack` was supplied by the client. It stays nullable: set it to
 * null and the Contact page omits the link rather than showing a dead one.
 */
export type ChannelLink = { label: string; href: string };

export const substack: ChannelLink | null = {
  label: "Substack",
  href: "https://tonyklinger.substack.com/",
};

export const socialLinks: ChannelLink[] = [
  { label: "YouTube", href: "https://www.youtube.com/@TDKlinger" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/tonyklinger/" },
  { label: "Facebook", href: "https://www.facebook.com/tony.klinger" },
  { label: "Instagram", href: "https://www.instagram.com/klinger.tony/" },
];
