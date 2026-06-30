"use client";

import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { UserRole } from "@prisma/client";

import { CollectionWorkspace } from "@/components/collections/collection-workspace";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CollectionDetailDTO, DealerCollectionContextDTO } from "@/types/collection";

interface AllocateCollectionPageClientProps {
  collection: CollectionDetailDTO | null;
  initialContext?: DealerCollectionContextDTO | null;
}

export function AllocateCollectionPageClient({
  collection,
  initialContext = null,
}: AllocateCollectionPageClientProps) {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;

  if (!collection) {
    return (
      <PageContainer title={t("collection.detail.loadError")}>
        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/50 px-6 py-16 text-center">
          <AlertCircle aria-hidden="true" className="mb-4 size-5 text-rose-500" />
          <p className="text-sm text-slate-600">{t("collection.detail.loadErrorDescription")}</p>
          <Link href="/collections" className="mt-4 text-sm font-medium text-blue-700">
            {t("collection.actions.backToList")}
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t("collection.workspace.allocateTitle").replace(
        "{collectionNo}",
        collection.collectionNo,
      )}
      description={t("collection.workspace.allocateSubtitle")}
      actions={
        <Link
          href={`/collections/${collection.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("collection.actions.backToDetail")}
        </Link>
      }
    >
      {userRole && (
        <CollectionWorkspace
          mode="allocate"
          collection={collection}
          userRole={userRole}
          initialContext={initialContext}
        />
      )}
    </PageContainer>
  );
}
