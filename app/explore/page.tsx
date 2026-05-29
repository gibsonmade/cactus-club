import { Suspense } from "react";
import { CactusApp } from "@/components/cactus-app";
import { buildExploreInitialData } from "@/lib/app-data";

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <CactusApp initialTab="Explore" initialData={buildExploreInitialData()} />
    </Suspense>
  );
}
