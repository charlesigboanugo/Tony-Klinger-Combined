"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { useVerifiedElsewhere } from "@/app/auth/2fa/useVerifiedElsewhere";

/**
 * On the setup page while this session is unconfirmed: if the second step is
 * completed in another tab, re-render as confirmed instead of waiting for a
 * manual refresh (owner, 2026-10-24).
 */
export function RefreshWhenVerified() {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useVerifiedElsewhere(refresh);
  return null;
}
