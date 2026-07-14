"use client";

import { useCallback, useState } from "react";

import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import type { UserProfileSummary } from "@/components/layout/user-profile-menu";
import { UserRole } from "@prisma/client";

interface DashboardShellProps {
  children: React.ReactNode;
  userRole?: UserRole;
  user?: UserProfileSummary | null;
}

export function DashboardShell({
  children,
  userRole = UserRole.Super_Admin,
  user = null,
}: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((previous) => !previous);
  }, []);

  const openMobileNav = useCallback(() => {
    setMobileNavOpen(true);
  }, []);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        userRole={userRole}
      />

      <MobileNav
        open={mobileNavOpen}
        onClose={closeMobileNav}
        userRole={userRole}
        user={user}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={openMobileNav}
          sidebarCollapsed={sidebarCollapsed}
          onSidebarToggle={toggleSidebar}
          user={user}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
