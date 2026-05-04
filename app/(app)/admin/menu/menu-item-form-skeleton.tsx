import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MenuItemFormSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-[1fr_200px]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-20 w-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
