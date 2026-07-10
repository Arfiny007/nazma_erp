"use client";

import Link from "next/link";
import { Map, MapPin, Users } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";

export function SettingsPageClient() {
  const { t } = useLanguage();

  const cards = [
    {
      href: "/settings/geography",
      title: t("settings.card.geography.title"),
      description: t("settings.card.geography.description"),
      icon: Map,
    },
    {
      href: "/settings/territories",
      title: t("settings.card.territories.title"),
      description: t("settings.card.territories.description"),
      icon: MapPin,
    },
    {
      href: "/settings/territory-assignments",
      title: t("settings.card.territoryAssignments.title"),
      description: t("settings.card.territoryAssignments.description"),
      icon: Users,
    },
  ];

  return (
    <PageContainer title={t("settings.title")} description={t("settings.subtitle")}>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <card.icon
              aria-hidden="true"
              className="mb-3 size-6 text-slate-400 transition-colors group-hover:text-slate-700 dark:group-hover:text-slate-200"
            />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              {card.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
