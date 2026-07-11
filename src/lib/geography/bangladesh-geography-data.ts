/**
 * Re-exports canonical geography seed data from the Prisma seed package.
 *
 * Application code imports from here; seed scripts import from
 * `prisma/seeds/data/` directly so Docker images that only bundle `prisma/`
 * do not need the full `src/` tree for base geography seeding.
 */
export {
  DISTRICTS,
  DIVISIONS,
  type DistrictSeed,
  type DivisionSeed,
} from "../../../prisma/seeds/data/bangladesh-geography-data";
