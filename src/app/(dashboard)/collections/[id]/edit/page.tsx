import { getCollection } from "@/lib/actions/collections/get-collection";
import { getDealerCollectionContext } from "@/lib/actions/collections/get-dealer-collection-context";
import { enforcePermission } from "@/lib/rbac/guards";
import { CollectionStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { EditCollectionPageClient } from "./page-client";

interface EditCollectionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCollectionPage({ params }: EditCollectionPageProps) {
  await enforcePermission("collections:edit");

  const { id } = await params;
  const result = await getCollection({ id });
  const collection = result.success ? result.data : null;

  if (collection && collection.status !== CollectionStatus.Draft) {
    redirect(`/collections/${id}`);
  }

  const dealerContext =
    collection &&
    (await getDealerCollectionContext({ dealerCode: collection.dealerCode }));

  return (
    <EditCollectionPageClient
      collection={collection}
      initialContext={dealerContext?.success ? dealerContext.data : null}
    />
  );
}
