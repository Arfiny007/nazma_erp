# ADR-039: Enterprise Dealer Ownership & Territory Migration

**Status:** Accepted  
**Date:** 2026-07-11  
**Phase:** PHASE_08C

## Context

PHASE_08A introduced geography FKs on `Dealer`. PHASE_08B introduced territory RBAC. Dealers still used legacy free-text `district`/`territory` fields without auditable ownership history or transfer lifecycle.

## Decision

### DealerOwnershipHistory model

Append-only organizational timeline:

- `dealerId` → `territoryId` → optional `assignedSrId`
- `effectiveFrom` / `effectiveTo` / `isActive`
- Only one `isActive = true` record per dealer (enforced in service layer)

### Ownership service (`src/lib/dealers/ownership/`)

| Function | Behavior |
|----------|----------|
| `assignDealerTerritory` | First ownership + sync geography FKs |
| `transferDealer` | Close active (`effectiveTo`, `isActive=false`) + create new |
| `getDealerOwnershipHistory` | Full timeline |
| `getCurrentDealerOwner` | Active record |
| `backfillDealerOwnership` | Legacy text → FK match + first ownership |

### Dealer form integration

Cascading Division → District → Territory selects. Territory validated against `buildTerritoryScope()`. Accounts: read-only.

### Financial immutability

Ownership changes update `Dealer.territoryId` only. Invoices, collections, ledger entries, and statements are never rewritten.

## Non-goals

Report snapshot integration, analytics, due reports, ownership transfer approval workflow UI.

## Compliance

Financial engines — NOT modified.
