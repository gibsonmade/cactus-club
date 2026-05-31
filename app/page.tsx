import { Suspense } from "react";
import { CactusApp } from "@/components/cactus-app";
import { buildHomeInitialData } from "@/lib/app-data";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <CactusApp initialTab="Today" initialData={buildHomeInitialData()} />
    </Suspense>
  );
}
