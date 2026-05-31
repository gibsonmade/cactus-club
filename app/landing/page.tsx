import { Suspense } from "react";
import { CactusLandingPage } from "@/components/cactus-app";
import { buildExploreInitialData } from "@/lib/app-data";

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <CactusLandingPage initialData={buildExploreInitialData()} />
    </Suspense>
  );
}
