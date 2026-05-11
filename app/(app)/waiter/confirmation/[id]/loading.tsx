import Link from "next/link";
import { CheckCircle2, Plus, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConfirmationLoading() {
  return (
    <div className="p-6 max-w-xl mx-auto">
      <Card className="p-8 text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Pesanan terkirim</div>
          <Skeleton className="h-9 w-32 mx-auto" />
          <Skeleton className="h-4 w-44 mx-auto" />
        </div>

        <Separator />

        <div className="space-y-2 text-left">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-between gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <span className="font-medium">Total</span>
          <Skeleton className="h-7 w-24" />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            render={<Link href="/waiter" />}
          >
            <ListOrdered className="h-4 w-4 mr-2" /> Pesanan
          </Button>
          <Button className="flex-1" render={<Link href="/waiter/new" />}>
            <Plus className="h-4 w-4 mr-2" /> Pesanan baru
          </Button>
        </div>
      </Card>
    </div>
  );
}
