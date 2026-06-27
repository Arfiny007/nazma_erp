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
    <section className="document-avoid-break mb-2 flex-1">
      <table className="doc-table doc-product-table" aria-label={labels.productTableCaption}>
        <thead>
          <tr className="doc-blue-bar">
            <th scope="col" className="col-sl text-center">{labels.columnSl}</th>
            <th scope="col" className="col-code">{labels.columnProductCode}</th>
            <th scope="col" className="col-name">{labels.columnProductName}</th>
            <th scope="col" className="col-unit text-center">{labels.columnUnit}</th>
            <th scope="col" className="col-qty text-right">{labels.columnQty}</th>
            <th scope="col" className="col-price text-right">{labels.columnUnitPrice}</th>
            <th scope="col" className="col-discount text-right">{labels.columnDiscount}</th>
            <th scope="col" className="col-amount text-right">{labels.columnAmount}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isEmpty = !row.productCode && !row.productName;
            return (
              <tr key={row.serial}>
                <td className="text-center tabular-nums">{row.serial}.</td>
                <td>{row.productCode}</td>
                <td>{row.productName}</td>
                <td className="text-center">{row.unit}</td>
                <td className="text-right tabular-nums">
                  {isEmpty ? "" : formatQuantity(row.quantity)}
                </td>
                <td className="text-right tabular-nums">
                  {isEmpty ? "" : formatMoney(row.unitPrice)}
                </td>
                <td className="text-right tabular-nums">
                  {isEmpty ? "" : formatMoney(row.discount)}
                </td>
                <td className="text-right tabular-nums">
                  {isEmpty ? "" : formatMoney(row.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
