import { ShieldX, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/helpers";

export const metadata: Metadata = {
  title: "Access Denied — Nazma ERP",
  description: "You do not have permission to view this page.",
};

// ---------------------------------------------------------------------------
// Role label map (server-side, no translation hook needed)
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, { en: string; bn: string }> = {
  Super_Admin: { en: "Super Admin", bn: "সুপার অ্যাডমিন" },
  Manager: { en: "Manager", bn: "ম্যানেজার" },
  Accounts: { en: "Accounts", bn: "অ্যাকাউন্টস" },
  SR: { en: "Sales Representative", bn: "সেলস রিপ্রেজেন্টেটিভ" },
};

export default async function AccessDeniedPage() {
  const user = await getCurrentUser();
  const roleLabel = user ? (ROLE_LABELS[user.role]?.en ?? user.role) : null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
          {/* Top accent strip */}
          <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-orange-400 to-amber-400" />

          <div className="px-8 py-10 sm:px-12 sm:py-12">
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div className="flex size-20 items-center justify-center rounded-2xl bg-red-50 ring-8 ring-red-50/50 dark:bg-red-950/30 dark:ring-red-950/20">
                <ShieldX
                  aria-hidden="true"
                  className="size-10 text-red-500 dark:text-red-400"
                />
              </div>
            </div>

            {/* Status code */}
            <p className="mb-2 text-center font-mono text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Error 403
            </p>

            {/* Heading */}
            <h1 className="mb-3 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              Access Denied
            </h1>

            {/* Subtitle */}
            <p className="mb-1 text-center text-base font-medium text-slate-700 dark:text-slate-300">
              প্রবেশাধিকার নেই
            </p>

            {/* Divider */}
            <div className="my-6 border-t border-slate-100 dark:border-slate-800" />

            {/* Description */}
            <p className="mb-2 text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Your current role does not grant access to this section.
            </p>
            <p className="text-center text-sm leading-relaxed text-slate-500 dark:text-slate-500">
              আপনার বর্তমান ভূমিকায় এই বিভাগে প্রবেশের অনুমতি নেই।
            </p>

            {/* Role badge */}
            {roleLabel && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-500">
                  Your role:
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {roleLabel}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-brand-500 dark:hover:bg-brand-400"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Back to Dashboard
              </Link>

              <a
                href="mailto:admin@nazma.local"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200/80 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Mail aria-hidden="true" className="size-4" />
                Contact Administrator
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/50 px-8 py-4 dark:border-slate-800 dark:bg-slate-900/30">
            <p className="text-center text-xs text-slate-400 dark:text-slate-600">
              If you believe this is a mistake, please contact your system administrator with your username and the page you were trying to access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
