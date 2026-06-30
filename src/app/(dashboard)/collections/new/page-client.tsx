"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { UserRole } from "@prisma/client";

import { CollectionWorkspace } from "@/components/collections/collection-workspace";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";

export function NewCollectionPageClient() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;

  return (
    <PageContainer
      title={t("collection.workspace.createTitle")}
      description={t("collection.workspace.createSubtitle")}
      actions={
        <Link
          href="/collections"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("collection.actions.backToList")}
        </Link>
      }
    >
      {userRole && <CollectionWorkspace mode="create" userRole={userRole} />}
    </PageContainer>
  );
}
