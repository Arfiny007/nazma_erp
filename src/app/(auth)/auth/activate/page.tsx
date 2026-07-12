import type { Metadata } from "next";
import { Suspense } from "react";

import { ActivationForm } from "@/components/auth/activation-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = {
  title: "Activate Account | Nazma ERP",
  description: "Activate your Nazma ERP account and set a permanent password.",
};

export default function ActivatePage() {
  return (
    <AuthPageShell
      title="Nazma ERP"
      subtitle="Activate your account"
    >
      <Suspense
        fallback={
          <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
        }
      >
        <ActivationForm />
      </Suspense>
    </AuthPageShell>
  );
}
