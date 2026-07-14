import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";

import { LanguageProvider } from "@/components/providers/language-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import {
  LOCALE_COOKIE_NAME,
  parseLocale,
} from "@/lib/i18n/locale-cookie";

import "./globals.css";
import "@/components/documents/styles/document-print.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nazma ERP",
    template: "%s | Nazma ERP",
  },
  description:
    "Premium B2B sales, collection, dealer management, and financial ledger platform for Nazma Metal Industries.",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <SessionProvider>
          <ThemeProvider>
            <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
