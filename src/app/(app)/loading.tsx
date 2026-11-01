import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-150">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 sm:w-64" />
          <Skeleton className="h-4 w-72 sm:w-96" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      {/* Main Content Card Skeleton */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="p-4 sm:p-6 pb-4 border-b space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Search/filter bar skeleton */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <Skeleton className="h-10 w-full sm:w-72" />
            <Skeleton className="h-10 w-full sm:w-36" />
          </div>

          {/* Table rows skeleton */}
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/20">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
