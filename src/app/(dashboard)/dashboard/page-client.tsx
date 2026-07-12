"use client";

import { useEffect, useState, useTransition } from "react";

import { DashboardShell } from "@/components/dashboard";
import { getDashboard, getDashboardAnalytics, getTerritoryMap } from "@/lib/actions/dashboard";
import type { AnalyticsPayloadDTO } from "@/types/analytics";
import type { DashboardPayloadDTO } from "@/types/dashboard";
import type { TerritoryMapPayloadDTO } from "@/types/maps";

export function DashboardPageClient() {
  const [payload, setPayload] = useState<DashboardPayloadDTO | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayloadDTO | null>(null);
  const [mapPayload, setMapPayload] = useState<TerritoryMapPayloadDTO | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const [dashboardResult, analyticsResult, mapResult] = await Promise.all([
        getDashboard(),
        getDashboardAnalytics(),
        getTerritoryMap(),
      ]);

      if (dashboardResult.success) {
        setPayload(dashboardResult.data);
        setErrorKey(null);
      } else {
        setPayload(null);
        setErrorKey(dashboardResult.error.messageKey);
      }

      if (analyticsResult.success) {
        setAnalytics(analyticsResult.data);
      } else if (dashboardResult.success) {
        setAnalytics(null);
      }

      if (mapResult.success) {
        setMapPayload(mapResult.data);
      } else if (dashboardResult.success) {
        setMapPayload(null);
      }
    });
  }, []);

  return (
    <DashboardShell
      analytics={analytics}
      errorKey={errorKey}
      isLoading={isPending && !payload && !errorKey}
      mapPayload={mapPayload}
      payload={payload}
    />
  );
}
