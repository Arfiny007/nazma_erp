import type { ReactNode } from "react";

export type DocumentTableAlign = "left" | "center" | "right";

export interface DocumentTableColumn<T> {
  key: string;
  header: string;
  align?: DocumentTableAlign;
  className?: string;
  render: (row: T, index: number) => ReactNode;
}

interface DocumentTableProps<T> {
  columns: DocumentTableColumn<T>[];
  rows: T[];
  caption: string;
  /** Applies product-row styling for invoice line tables. */
  variant?: "product" | "standard" | "statement";
  rowKey: (row: T, index: number) => string;
  /** Optional per-row class for presentation accents (e.g. statement posting types). */
  getRowClassName?: (row: T, index: number) => string | undefined;
  /** When true, the table may break across printed pages (long statements). */
  allowPageBreak?: boolean;
}

function alignClass(align: DocumentTableAlign = "left"): string {
  switch (align) {
    case "center":
      return "text-center";
    case "right":
      return "text-right";
    default:
      return "text-left";
  }
}

/** Generic print-safe data table for document engine surfaces. */
export function DocumentTable<T>({
  columns,
  rows,
  caption,
  variant = "standard",
  rowKey,
  getRowClassName,
  allowPageBreak = false,
}: DocumentTableProps<T>) {
  const tableClass =
    variant === "product"
      ? "doc-table doc-product-table"
      : variant === "statement"
        ? "doc-table doc-statement-table"
        : "doc-table doc-data-table";

  const sectionClass = allowPageBreak
    ? "mb-2 flex-1"
    : "document-avoid-break mb-2 flex-1";

  return (
    <section className={sectionClass}>
      <table className={tableClass} aria-label={caption}>
        <thead>
          <tr className="doc-blue-bar">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`${alignClass(column.align)} ${column.className ?? ""}`.trim()}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className={getRowClassName?.(row, index) ?? undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`${alignClass(column.align)} ${column.className ?? ""}`.trim()}
                >
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
