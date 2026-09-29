/*
  What the newsletter FORM needs, kept apart from the schema so the form —
  which is in the footer of every page — does not pull Zod into every page's
  JavaScript (note 10 §47.3). The schema lives in ./newsletter.
*/

/** The exact wording a subscriber agrees to. Stored with the consent record —
 *  consent to wording we cannot reproduce is not evidence of anything. */
export const NEWSLETTER_CONSENT_TEXT =
  "Yes, email me occasional news about Tony Klinger's coaching, courses, books and films. I can unsubscribe at any time.";

export type NewsletterFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};
