import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function CashierOrderLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/cashier" />}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to cashier
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_380px]">
        <Card className="p-5 gap-0">
          <div className="grid grid-cols-2 gap-3 pb-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
          <Separator />
          <div className="py-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex justify-between gap-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex justify-between items-center pt-4">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-7 w-24" />
          </div>
        </Card>

        <Card className="p-5 gap-4">
          <Skeleton className="h-5 w-28" />
          <div className="grid gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </Card>
      </div>
    </div>
  );
}
