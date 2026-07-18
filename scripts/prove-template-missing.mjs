import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const row = await prisma.notificationTemplate.findUnique({
  where: {
    key_locale_channel: {
      key: "USER_ACTIVATION_EMAIL",
      locale: "en",
      channel: "EMAIL",
    },
  },
});

console.log("template row:", row);

if (!row) {
  const error = new Error("Notification template not found");
  error.name = "NotificationTemplateNotFoundError";
  error.code = "TEMPLATE_NOT_FOUND";
  throw error;
}

await prisma.$disconnect();
