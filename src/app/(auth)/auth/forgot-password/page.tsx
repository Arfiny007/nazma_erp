import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = {
  title: "Forgot Password | Nazma ERP",
  description: "Request a password reset for your Nazma ERP account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      title="Nazma ERP"
      subtitle="Reset your password"
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
