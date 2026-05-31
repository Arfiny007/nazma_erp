import type { LucideIcon } from "lucide-react";

import type { Permission } from "@/lib/permissions";

export interface NavItem {
  id: string;
  labelKey: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  badgeKey?: string;
}

export interface NavSection {
  id: string;
  labelKey?: string;
  items: NavItem[];
}
