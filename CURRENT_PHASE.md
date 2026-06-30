# CURRENT_PHASE.md



Current Phase:



PHASE_06B_ENTERPRISE_COLLECTIONS_UI



Status:



COMPLETE



---



## Roadmap — Fulfillment, Invoicing & Collections



| Phase | Description | Status |

|-------|-------------|--------|

| PHASE_04A_ORDER_BACKEND | Sales Order backend | ✅ COMPLETE |

| PHASE_04B_ORDER_UI | Sales Order UI | ✅ COMPLETE |

| PHASE_04C_ORDER_COMBOBOX_DIAGNOSTICS | DealerCombobox fix | ✅ COMPLETE |

| PHASE_05A_DELIVERY_CHALLAN_BACKEND | Delivery Challan backend (validators, DTOs, workflow guards) | ✅ COMPLETE |

| PHASE_05A1_DELIVERY_CHALLAN_SCHEMA | Delivery Challan Prisma schema + migration | ✅ COMPLETE |

| PHASE_05A2_DELIVERY_CHALLAN_ACTIONS | Server actions, challan number generator, order integration | ✅ COMPLETE |

| PHASE_05B_DELIVERY_CHALLAN_UI | Delivery Challan UI (create from order, list, detail, dispatch) | ✅ COMPLETE |

| PHASE_05C1_INVOICE_ENGINE_BACKEND | Invoice backend from confirmed challan (+ mandatory InvoiceItem) | ✅ COMPLETE |

| PHASE_05C2_FINANCIAL_INTEGRITY_AUDIT | Pre-production accounting review; ADR-015 | ✅ COMPLETE |

| PHASE_05C2A_FINANCIAL_CONCURRENCY_HOTFIX | Dealer row lock, atomic balance, idempotency, concurrency tests | ✅ COMPLETE |

| PHASE_05D1_ENTERPRISE_INVOICE_UI | Invoice list, detail, issue workflow (UI only — no PDF) | ✅ COMPLETE |

| PHASE_05D2_ENTERPRISE_DOCUMENT_ENGINE | Printable invoice document engine (preview, print, PDF) | ✅ COMPLETE |

| PHASE_05D3_ENTERPRISE_INVOICE_QA | Production QA certification before Collections | ✅ COMPLETE |

| PHASE_06A1_COLLECTIONS_SCHEMA_FOUNDATION | Collections schema, DTOs, validators, ADR-019 | ✅ COMPLETE |

| PHASE_06A2_COLLECTION_ENGINE_AND_ALLOCATION | Collection server actions, allocation engine, posting, reversal | ✅ COMPLETE |

| PHASE_06A3_FINANCIAL_CONSISTENCY_AUDIT | Pre-UI financial certification; ADR-021 | ✅ COMPLETE |

| **PHASE_06B_ENTERPRISE_COLLECTIONS_UI** | Collection list, workspace, allocation UI, reversal UX | **✅ COMPLETE** |



---



# PHASE_06B_ENTERPRISE_COLLECTIONS_UI



Status: COMPLETE



## Objectives



Enterprise accountant-grade Collections UI using certified PHASE_06A backend.



* Collection list with search, filters, pagination, sorting

* Unified Collection Workspace (create / draft edit / allocate)

* Dealer financial summary + outstanding invoices

* Live allocation summary with server preview

* Advance payment visualization

* Detail view with allocation history and audit timeline

* Reversal dialog with required reason

* ADR-022 — Enterprise Collections UI



### Completion Criteria



* Routes: `/collections`, `/new`, `/[id]`, `/[id]/edit`, `/[id]/allocate`: ✓

* Hybrid Server/Client architecture: ✓

* RBAC via existing permissions: ✓

* Bilingual localization: ✓

* `npx prisma generate`, `tsc`, `eslint`: ✓

* Governance docs updated: ✓



### Explicitly NOT Built



* Money receipt PDF, ledger entries, due reports, dashboards



---



## Next Phase



**PHASE_07_LEDGER** — Ledger entry posting via posting service extension.
