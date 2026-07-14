import { getCurrentUser } from "@/lib/auth/helpers";
import {
  searchNotifications,
  searchTemplates,
} from "@/lib/notifications";
import { getNotificationMetrics } from "@/lib/notifications/worker/notification-worker";
import { enforcePermission } from "@/lib/rbac/guards";

import { NotificationsPageClient } from "./page-client";

export default async function NotificationsSettingsPage() {
  await enforcePermission("notifications:view");
  const actor = await getCurrentUser();

  if (!actor) {
    return null;
  }

  const [initialNotifications, initialTemplates, initialMetrics] = await Promise.all([
    searchNotifications({ page: 1, pageSize: 25 }),
    searchTemplates({ page: 1, pageSize: 25 }),
    getNotificationMetrics(),
  ]);

  return (
    <NotificationsPageClient
      actor={actor}
      initialMetrics={initialMetrics}
      initialNotifications={initialNotifications}
      initialTemplates={initialTemplates}
    />
  );
}
