import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = {
  title: "Change Password | Nazma ERP",
  description: "Set a new password for your Nazma ERP account.",
};

export default function ChangePasswordPage() {
  return (
    <AuthPageShell
      title="Nazma ERP"
      subtitle="Change your password"
    >
      <ChangePasswordForm />
    </AuthPageShell>
  );
}
