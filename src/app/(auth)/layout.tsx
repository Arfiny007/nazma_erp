import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      {children}
    </div>
  );
}
