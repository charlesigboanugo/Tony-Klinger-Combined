import { z } from "./z";

export { NEWSLETTER_CONSENT_TEXT, type NewsletterFormState } from "./newsletter-copy";

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

