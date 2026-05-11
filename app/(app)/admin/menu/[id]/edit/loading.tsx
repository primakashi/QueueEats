import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { MenuItemFormSkeleton } from "../../menu-item-form-skeleton";

export default function EditMenuItemLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Ubah item menu"
        description={undefined}
      />
      <div className="-mt-4 mb-6">
        <Skeleton className="h-4 w-48" />
      </div>
      <MenuItemFormSkeleton />
    </div>
  );
}
