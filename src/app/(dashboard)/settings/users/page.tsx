import { getCurrentUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/prisma";
import { enforcePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";

import { UsersPageClient } from "./page-client";

export default async function UsersSettingsPage() {
  await enforcePermission("users:view");
  const actor = await getCurrentUser();

  if (!actor) {
    return null;
  }

  const scope = await buildTerritoryScope(actor.id);

  const territories =
    scope.mode === "NONE"
      ? []
      : await prisma.territory.findMany({
          where:
            scope.mode === "ALL"
              ? { isActive: true }
              : { isActive: true, id: { in: [...scope.territoryIds] } },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
          take: 200,
        });

  const territoryOptions = territories.map((territory) => ({
    id: territory.id,
    label: `${territory.name} (${territory.code})`,
  }));

  return (
    <UsersPageClient actor={actor} territoryOptions={territoryOptions} />
  );
}
