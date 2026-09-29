import { z } from "./z";

/** Shared auth field rules. Server-side validation is authoritative (note 10 §25). */

export const emailField = z
  .string()
  .min(1, "Enter your email address")
  .email("Enter a valid email address");

export const passwordField = z.string().min(8, "Use at least 8 characters");

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  email: emailField,
  password: passwordField,
  displayName: z.string().trim().min(1, "Enter your name").max(80),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const magicLinkSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/** Shape returned by every auth Server Action, consumed by `useActionState`. */
export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
};

/** Flatten a ZodError into the field-error shape the forms render. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
