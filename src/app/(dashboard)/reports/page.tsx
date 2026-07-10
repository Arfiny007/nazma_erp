import { enforcePermission } from "@/lib/rbac/guards";
import { redirect } from "next/navigation";

export default async function ReportsIndexPage() {
  await enforcePermission("reports:view");
  redirect("/reports/due");
}
