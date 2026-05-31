import { Suspense } from "react";
import { CactusApp } from "@/components/cactus-app";
import { buildHomeInitialData } from "@/lib/app-data";

export default function TodayPage() {
  return (
    <Suspense fallback={null}>
      <CactusApp initialTab="Today" initialData={buildHomeInitialData()} />
    </Suspense>
  );
}
