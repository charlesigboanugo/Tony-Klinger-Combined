"use client";

import { useEffect } from "react";

import { announceVisitorChange } from "@/components/navigation/useVisitor";

/** Tells the masthead to re-read the visitor whenever `signal` changes. */
export function VisitorSync({ signal }: { signal: string | number }) {
  useEffect(() => {
    announceVisitorChange();
  }, [signal]);
  return null;
}
