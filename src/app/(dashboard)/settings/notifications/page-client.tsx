"use client";

import { PageContainer } from "@/components/layout/page-container";
import { NotificationQueuePanel } from "@/components/notifications/notification-queue-panel";
import { NotificationsConsole } from "@/components/notifications/notifications-console";
import type { NotificationMetricsDTO } from "@/lib/actions/notifications/get-notification-metrics";
import type { AuthUser } from "@/types/auth";
import type {
  NotificationListDTO,
  NotificationTemplateListDTO,
} from "@/types/notification";

interface NotificationsPageClientProps {
  actor: AuthUser;
  initialNotifications: NotificationListDTO;
  initialTemplates: NotificationTemplateListDTO;
  initialMetrics: NotificationMetricsDTO;
}

export function NotificationsPageClient({
  actor,
  initialNotifications,
  initialTemplates,
  initialMetrics,
}: NotificationsPageClientProps) {
  return (
    <PageContainer>
      <div className="space-y-8">
        <NotificationQueuePanel actor={actor} initialMetrics={initialMetrics} />
        <NotificationsConsole
          actor={actor}
          initialNotifications={initialNotifications}
          initialTemplates={initialTemplates}
        />
      </div>
    </PageContainer>
  );
}
