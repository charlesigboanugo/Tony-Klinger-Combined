import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

export type Testimonial = {
  id: string;
  quote: string;
  attributed_to: string | null;
  attribution_detail: string | null;
  context: string | null;
  featured: boolean;
};

/**
 * Published testimonials — note 07.
 *
 * `context` narrows them to where they belong, and a null context means the
 * quote works anywhere, so it is always included rather than filtered out.
 */
export async function listTestimonials(options?: {
  context?: string;
  featuredOnly?: boolean;
  limit?: number;
}): Promise<Testimonial[]> {
  const supabase = createPublicClient();

  let query = supabase
    .from("testimonials")
    .select("id,quote,attributed_to,attribution_detail,context,featured")
    .eq("status", "published")
    .order("position", { ascending: true });

  if (options?.context) {
    query = query.or(`context.eq.${options.context},context.is.null`);
  }
  if (options?.featuredOnly) query = query.eq("featured", true);
  if (options?.limit) query = query.limit(options.limit);

  const { data } = await query;
  return (data as Testimonial[] | null) ?? [];
}
