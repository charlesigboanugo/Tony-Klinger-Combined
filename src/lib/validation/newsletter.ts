import { z } from "zod";

/** The exact wording a subscriber agrees to. Stored with the consent record —
 *  consent to wording we cannot reproduce is not evidence of anything. */
export const NEWSLETTER_CONSENT_TEXT =
  "Yes, email me occasional news about Tony Klinger's coaching, courses, books and films. I can unsubscribe at any time.";

export const newsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address."),
  // Must be explicitly true. A pre-ticked box is not consent under UK GDPR, so
  // the box is unticked in the markup and its value is required here.
  consent: z.string().refine((value) => value === "on", {
    message: "Please tick the box to confirm you want these emails.",
  }),
  website: z.string().max(0, "Submission rejected.").optional(),
});

export type NewsletterFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};
