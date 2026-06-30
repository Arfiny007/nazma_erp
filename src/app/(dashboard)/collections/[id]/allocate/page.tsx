import { getCollection } from "@/lib/actions/collections/get-collection";
import { getDealerCollectionContext } from "@/lib/actions/collections/get-dealer-collection-context";
import { enforcePermission } from "@/lib/rbac/guards";
import { CollectionStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { AllocateCollectionPageClient } from "./page-client";

interface AllocateCollectionPageProps {
  params: Promise<{ id: string }>;
}

export default async function AllocateCollectionPage({
  params,
}: AllocateCollectionPageProps) {
  await enforcePermission("collections:edit");

  const { id } = await params;
  const result = await getCollection({ id });
  const collection = result.success ? result.data : null;

  if (!collection) {
    return <AllocateCollectionPageClient collection={null} />;
  }

  if (collection.status === CollectionStatus.Draft) {
    redirect(`/collections/${id}/edit`);
  }

  if (
    collection.status === CollectionStatus.Reversed ||
    Number.parseFloat(collection.unallocatedAmount) <= 0
  ) {
    redirect(`/collections/${id}`);
  }

  const dealerContext = await getDealerCollectionContext({
    dealerCode: collection.dealerCode,
  });

  return (
    <AllocateCollectionPageClient
      collection={collection}
      initialContext={dealerContext.success ? dealerContext.data : null}
    />
  );
}
