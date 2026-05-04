import { PageHeader } from "@/components/page-header";
import { MenuItemFormSkeleton } from "../menu-item-form-skeleton";

export default function NewMenuItemLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="New menu item"
        description="Add a new item to the menu"
      />
      <MenuItemFormSkeleton />
    </div>
  );
}
