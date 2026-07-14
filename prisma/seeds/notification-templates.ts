import type { NotificationChannel, PrismaClient } from "@prisma/client";

interface NotificationTemplateSeed {
  key: string;
  channel: NotificationChannel;
  locale: string;
  subject: string;
  body: string;
}

const COMPANY_NAME = "Nazma Metal Industries";

const TEMPLATE_SEEDS: NotificationTemplateSeed[] = [
  {
    key: "USER_ACTIVATION_EMAIL",
    channel: "EMAIL",
    locale: "en",
    subject: "Activate your {{company}} account",
    body: `Hello {{name}},

Welcome to {{company}}. Please activate your account using the link below:

{{link}}

This link expires on {{date}}.

— {{company}}`,
  },
  {
    key: "USER_ACTIVATION_EMAIL",
    channel: "EMAIL",
    locale: "bn",
    subject: "আপনার {{company}} অ্যাকাউন্ট সক্রিয় করুন",
    body: `প্রিয় {{name}},

{{company}}-এ স্বাগতম। নিচের লিংক ব্যবহার করে আপনার অ্যাকাউন্ট সক্রিয় করুন:

{{link}}

এই লিংকের মেয়াদ {{date}} পর্যন্ত।

— {{company}}`,
  },
  {
    key: "PASSWORD_RESET_EMAIL",
    channel: "EMAIL",
    locale: "en",
    subject: "Reset your {{company}} password",
    body: `Hello {{name}},

We received a request to reset your password. Use the link below:

{{link}}

If you did not request this, please ignore this email.

— {{company}}`,
  },
  {
    key: "PASSWORD_RESET_EMAIL",
    channel: "EMAIL",
    locale: "bn",
    subject: "আপনার {{company}} পাসওয়ার্ড রিসেট করুন",
    body: `প্রিয় {{name}},

আপনার পাসওয়ার্ড রিসেটের অনুরোধ পেয়েছি। নিচের লিংক ব্যবহার করুন:

{{link}}

আপনি যদি এটি অনুরোধ না করে থাকেন, তাহলে এই ইমেইল উপেক্ষা করুন।

— {{company}}`,
  },
  {
    key: "DUE_REMINDER_EMAIL",
    channel: "EMAIL",
    locale: "en",
    subject: "Payment reminder from {{company}}",
    body: `Hello {{name}},

This is a reminder regarding outstanding dues as of {{date}}.

Please review your account or contact {{company}} for assistance.

— {{company}}`,
  },
  {
    key: "DUE_REMINDER_EMAIL",
    channel: "EMAIL",
    locale: "bn",
    subject: "{{company}} থেকে পেমেন্ট অনুস্মারক",
    body: `প্রিয় {{name}},

{{date}} তারিখ পর্যন্ত বকেয়া সম্পর্কে একটি অনুস্মারক।

অনুগ্রহ করে আপনার অ্যাকাউন্ট পর্যালোচনা করুন অথবা সহায়তার জন্য {{company}}-এর সাথে যোগাযোগ করুন।

— {{company}}`,
  },
  {
    key: "INTEGRITY_ALERT_EMAIL",
    channel: "EMAIL",
    locale: "en",
    subject: "Financial integrity alert — {{company}}",
    body: `Hello {{name}},

A financial integrity alert was detected on {{date}}.

Please review the integrity console immediately.

— {{company}}`,
  },
  {
    key: "INTEGRITY_ALERT_EMAIL",
    channel: "EMAIL",
    locale: "bn",
    subject: "আর্থিক অখণ্ডতা সতর্কতা — {{company}}",
    body: `প্রিয় {{name}},

{{date}} তারিখে একটি আর্থিক অখণ্ডতা সতর্কতা সনাক্ত হয়েছে।

অনুগ্রহ করে অবিলম্বে ইন্টিগ্রিটি কনসোল পর্যালোচনা করুন।

— {{company}}`,
  },
];

export async function seedNotificationTemplates(
  prisma: PrismaClient,
): Promise<void> {
  for (const template of TEMPLATE_SEEDS) {
    const subject = template.subject.replace(/\{\{company\}\}/g, COMPANY_NAME);
    const body = template.body.replace(/\{\{company\}\}/g, COMPANY_NAME);

    await prisma.notificationTemplate.upsert({
      where: {
        key_locale_channel: {
          key: template.key,
          locale: template.locale,
          channel: template.channel,
        },
      },
      update: {
        subject,
        body,
        isActive: true,
      },
      create: {
        key: template.key,
        channel: template.channel,
        locale: template.locale,
        subject,
        body,
        isActive: true,
      },
    });
  }

  console.log(`  ✓ ${TEMPLATE_SEEDS.length} notification templates seeded`);
}
