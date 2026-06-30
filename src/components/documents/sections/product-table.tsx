import { DocumentTable } from "@/components/documents/sections/document-table";
import { DOCUMENT_MAX_PRODUCT_ROWS } from "@/types/document";
import type { DocumentLabels, DocumentProductRowDTO } from "@/types/document";
import type { InvoiceItemDTO } from "@/types/invoice";

interface ProductTableProps {
  items: InvoiceItemDTO[];
  labels: Pick<
    DocumentLabels,
    | "columnSl"
    | "columnProductCode"
    | "columnProductName"
    | "columnUnit"
    | "columnQty"
    | "columnUnitPrice"
    | "columnDiscount"
    | "columnAmount"
    | "productTableCaption"
  >;
  formatMoney: (value: string) => string;
  formatQuantity: (value: string) => string;
}

function toProductRows(items: InvoiceItemDTO[]): DocumentProductRowDTO[] {
  return items.map((item, index) => ({
    serial: index + 1,
    productCode: item.productCode,
    productName: item.productName,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    amount: item.lineTotal,
  }));
}

function padRows(rows: DocumentProductRowDTO[]): DocumentProductRowDTO[] {
  const padded = [...rows];
  while (padded.length < DOCUMENT_MAX_PRODUCT_ROWS) {
    padded.push({
      serial: padded.length + 1,
      productCode: "",
      productName: "",
      unit: "",
      quantity: "",
      unitPrice: "",
      discount: "",
      amount: "",
    });
  }
  return padded.slice(0, DOCUMENT_MAX_PRODUCT_ROWS);
}

/**
 * Fixed 20-row product grid — always renders exactly DOCUMENT_MAX_PRODUCT_ROWS
 * rows so A4 layout never shifts between 1 and 20 line invoices.
 */
export function ProductTable({
  items,
  labels,
  formatMoney,
  formatQuantity,
}: ProductTableProps) {
  const rows = padRows(toProductRows(items));

  return (
    <DocumentTable
      variant="product"
      caption={labels.productTableCaption}
      rows={rows}
      rowKey={(row) => String(row.serial)}
      columns={[
        {
          key: "sl",
          header: labels.columnSl,
          align: "center",
          className: "col-sl",
          render: (row) => `${row.serial}.`,
        },
        {
          key: "code",
          header: labels.columnProductCode,
          className: "col-code",
          render: (row) => row.productCode,
        },
        {
          key: "name",
          header: labels.columnProductName,
          className: "col-name",
          render: (row) => row.productName,
        },
        {
          key: "unit",
          header: labels.columnUnit,
          align: "center",
          className: "col-unit",
          render: (row) => row.unit,
        },
        {
          key: "qty",
          header: labels.columnQty,
          align: "right",
          className: "col-qty",
          render: (row) => {
            const isEmpty = !row.productCode && !row.productName;
            return isEmpty ? "" : formatQuantity(row.quantity);
          },
        },
        {
          key: "price",
          header: labels.columnUnitPrice,
          align: "right",
          className: "col-price",
          render: (row) => {
            const isEmpty = !row.productCode && !row.productName;
            return isEmpty ? "" : formatMoney(row.unitPrice);
          },
        },
        {
          key: "discount",
          header: labels.columnDiscount,
          align: "right",
          className: "col-discount",
          render: (row) => {
            const isEmpty = !row.productCode && !row.productName;
            return isEmpty ? "" : formatMoney(row.discount);
          },
        },
        {
          key: "amount",
          header: labels.columnAmount,
          align: "right",
          className: "col-amount",
          render: (row) => {
            const isEmpty = !row.productCode && !row.productName;
            return isEmpty ? "" : formatMoney(row.amount);
          },
        },
      ]}
    />
  );
}

export { DocumentTable };
