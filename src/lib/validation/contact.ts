import { z } from "zod";

/**
 * Contact form — note 03 §8.
 *
 * Bounds are set to what a genuine enquiry needs. They are not the anti-abuse
 * measure (Turnstile and the rate limiter are), but they stop a single
 * submission carrying a megabyte of text into the database and the outbox.
 */
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(100, "That name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address."),
  subject: z.string().trim().max(150, "That subject is too long.").optional(),
  message: z
    .string()
    .trim()
    .min(20, "Please give us a little more detail — at least 20 characters.")
    .max(5000, "That message is too long. Please keep it under 5000 characters."),
  // Honeypot. Hidden from people, irresistible to naive bots. Not a real
  // defence on its own — it stops the crude scripts so the Turnstile budget and
  // the rate limiter are spent on the ones that matter.
  website: z.string().max(0, "Submission rejected.").optional(),
});

export type ContactFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  /** Echoed back so a rejected submission does not lose what was typed. */
  values?: { name?: string; email?: string; subject?: string; message?: string };
  /**
   * True when Turnstile verification actually ran, which CONSUMES the token.
   *
   * The widget must be reset only in that case. Resetting after a failure that
   * never reached verification — a validation error, the rate limit — throws
   * away a perfectly good token and leaves the widget re-solving, so a prompt
   * retry submits nothing and fails for a reason the visitor cannot see.
   */
  captchaSpent?: boolean;
};
