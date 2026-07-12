import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = {
  title: "Reset Password | Nazma ERP",
  description: "Set a new password for your Nazma ERP account.",
};

export default function ResetPasswordPage() {
  return (
    <AuthPageShell
      title="Nazma ERP"
      subtitle="Set a new password"
    >
      <Suspense
        fallback={
          <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthPageShell>
  );
}
