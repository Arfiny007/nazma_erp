import { getCollection } from "@/lib/actions/collections/get-collection";
import { enforcePermission } from "@/lib/rbac/guards";
import { CollectionStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { CollectionDetailPageClient } from "./page-client";

interface CollectionDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reverse?: string }>;
}

export default async function CollectionDetailPage({
  params,
  searchParams,
}: CollectionDetailPageProps) {
  await enforcePermission("collections:view");

  const { id } = await params;
  const { reverse } = await searchParams;
  const result = await getCollection({ id });
  const collection = result.success ? result.data : null;

  if (collection?.status === CollectionStatus.Draft) {
    redirect(`/collections/${id}/edit`);
  }

  return (
    <CollectionDetailPageClient
      collection={collection}
      openReverseOnMount={reverse === "1"}
    />
  );
}
