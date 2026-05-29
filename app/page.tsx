import { CactusApp } from "@/components/cactus-app";
import { buildHomeInitialData } from "@/lib/app-data";

export default function HomePage() {
  return <CactusApp initialTab="Today" initialData={buildHomeInitialData()} />;
}
