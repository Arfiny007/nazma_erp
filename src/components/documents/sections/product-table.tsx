import { DocumentTable } from "@/components/documents/sections/document-table";
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

/**
 * Dynamic product grid — renders only actual invoice line items with no
 * placeholder padding rows. Table height grows naturally with line count.
 */
export function ProductTable({
  items,
  labels,
  formatMoney,
  formatQuantity,
}: ProductTableProps) {
  const rows = toProductRows(items);

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
          render: (row) => formatQuantity(row.quantity),
        },
        {
          key: "price",
          header: labels.columnUnitPrice,
          align: "right",
          className: "col-price",
          render: (row) => formatMoney(row.unitPrice),
        },
        {
          key: "amount",
          header: labels.columnAmount,
          align: "right",
          className: "col-amount",
          render: (row) => formatMoney(row.amount),
        },
      ]}
    />
  );
}

export { DocumentTable };
