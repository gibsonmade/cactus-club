import { Suspense } from "react";
import { CactusApp } from "@/components/cactus-app";

export default function PlacesPage() {
  return (
    <Suspense fallback={null}>
      <CactusApp initialTab="Places" />
    </Suspense>
  );
}
