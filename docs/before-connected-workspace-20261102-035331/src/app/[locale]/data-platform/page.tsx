import { Suspense } from "react";

import { DataPlatformDashboard } from "@/components/pages/DataPlatform";
import { Skeleton } from "@uiShare/molecules/Loading/LoadingSkeleton";

export default function DataPlatformPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <DataPlatformDashboard />
    </Suspense>
  );
}
