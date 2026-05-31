import { Suspense } from "react";
import { CactusApp } from "@/components/cactus-app";

export default function MyPlanPage() {
  return (
    <Suspense fallback={null}>
      <CactusApp initialTab="Plan" />
    </Suspense>
  );
}
