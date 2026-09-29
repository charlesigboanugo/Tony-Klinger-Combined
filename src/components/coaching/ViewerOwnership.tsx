"use client";

import { createContext, useContext, useEffect, useState, type ComponentProps, type ReactNode } from "react";

import { viewerEntitlementAction } from "@/app/(public)/coaching/actions";
import { OwnedState } from "@/components/coaching/OwnedState";
import { MobileBuyBar, PurchasePanel } from "@/components/coaching/ProductPage";
import type { EntitlementState } from "@/lib/commerce/entitlements";

/**
 * The visitor's access to one product, looked up after the page loads.
 *
 * Product pages are pre-built and identical for everyone (note 10 §47.1), so
 * they render the guest view and switch to "you already have access" once the
 * answer arrives. Nothing is authorized here: checkout re-checks entitlement.
 */
const Ownership = createContext<EntitlementState>({ state: "none" });

export function OwnershipProvider({
  resourceType,
  resourceId,
  children,
}: {
  resourceType: "course" | "cohort" | "group_coaching_series";
  resourceId: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<EntitlementState>({ state: "none" });

  useEffect(() => {
    let live = true;
    viewerEntitlementAction(resourceType, resourceId)
      .then((s) => {
        if (live) setState(s);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [resourceType, resourceId]);

  return <Ownership.Provider value={state}>{children}</Ownership.Provider>;
}

function useOwned() {
  return useContext(Ownership).state === "active";
}

export function ViewerOwnedState(props: Omit<ComponentProps<typeof OwnedState>, "entitlement">) {
  return <OwnedState {...props} entitlement={useContext(Ownership)} />;
}

/** Rendered only while the visitor does NOT already hold the product. */
export function UnlessOwned({ children }: { children: ReactNode }) {
  return useOwned() ? null : <>{children}</>;
}

/** The purchase panel, without its price once the visitor owns the product. */
export function ViewerPurchasePanel(props: ComponentProps<typeof PurchasePanel>) {
  const owned = useOwned();
  return <PurchasePanel {...props} price={owned ? null : props.price} priceNote={owned ? null : props.priceNote} />;
}

export function ViewerMobileBuyBar(props: ComponentProps<typeof MobileBuyBar>) {
  return useOwned() ? null : <MobileBuyBar {...props} />;
}
