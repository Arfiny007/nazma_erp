import { DISTRICTS } from "./bangladesh-geography-data";

/**
 * Territory seed structure for PHASE_08A.
 *
 * Seeds one default sales territory per district. Companies can add finer-grained
 * territories later via the admin UI.
 */
export interface TerritorySeedTemplate {
  districtCode: string;
  code?: string;
  name?: string;
  nameBn?: string;
  sortOrder?: number;
}

export function buildDefaultTerritorySeeds(): TerritorySeedTemplate[] {
  return DISTRICTS.map((district) => ({
    districtCode: district.code,
    code: `${district.code}-main`,
    name: `${district.name} — Main`,
    nameBn: `${district.nameBn} — মূল`,
    sortOrder: 1,
  }));
}
