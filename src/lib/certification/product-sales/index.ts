export {
  runTerritoryProductSalesCertification,
  runTerritoryProductSalesCertificationWithReport,
} from "./product-sales-certification-service";

export { runProductSalesCertificationChecks } from "./product-sales-certification-validation";

export type {
  ProductSalesCertificationCheckResult,
  ProductSalesCertificationResult,
  ProductSalesCertificationScores,
} from "./product-sales-certification-types";

export { PRODUCT_SALES_CERTIFICATION_VERSION } from "./product-sales-certification-types";
