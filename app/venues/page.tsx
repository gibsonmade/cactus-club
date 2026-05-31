import { Suspense } from "react";
import { CactusApp } from "@/components/cactus-app";

export default function VenuesPage() {
  return (
    <Suspense fallback={null}>
      <CactusApp initialTab="Places" />
    </Suspense>
  );
}
