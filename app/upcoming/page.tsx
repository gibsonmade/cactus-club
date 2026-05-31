import { Suspense } from "react";
import { CactusApp } from "@/components/cactus-app";

export default function UpcomingPage() {
  return (
    <Suspense fallback={null}>
      <CactusApp initialTab="Today" />
    </Suspense>
  );
}
