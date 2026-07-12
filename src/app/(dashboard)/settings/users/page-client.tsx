"use client";

import Link from "next/link";

import { UsersConsole } from "@/components/users";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AuthUser } from "@/types/auth";

interface TerritoryOption {
  id: string;
  label: string;
}

interface UsersPageClientProps {
  actor: AuthUser;
  territoryOptions: TerritoryOption[];
}

export function UsersPageClient({ actor, territoryOptions }: UsersPageClientProps) {
  const { t } = useLanguage();

  return (
    <PageContainer
      title={t("userManagement.page.title")}
      description={t("userManagement.page.subtitle")}
      actions={
        <Link
          href="/settings"
          className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300"
        >
          {t("userManagement.page.backToSettings")}
        </Link>
      }
    >
      <UsersConsole actor={actor} territoryOptions={territoryOptions} />
    </PageContainer>
  );
}
