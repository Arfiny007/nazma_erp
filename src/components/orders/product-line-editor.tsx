"use client";

import { Check, ChevronsUpDown, Package, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { ProductDTO } from "@/types/product";

/** A single editable order line held in the form's state. */
export interface OrderLineRow {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  /** True once the user has manually edited the unit price for this line. */
  priceTouched: boolean;
}

/** Removes everything except digits and a single decimal point (max 2 dp). */
export function sanitizeDecimal(value: string): string {
  let cleaned = value.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot !== -1) {
    cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
  }
  const [intPart, decPart] = cleaned.split(".");
  const normalizedInt = intPart.replace(/^0+(?=\d)/, "");
  if (decPart === undefined) {
    return normalizedInt;
  }
  return `${normalizedInt === "" ? "0" : normalizedInt}.${decPart.slice(0, 2)}`;
}

interface ProductPickerProps {
  products: ProductDTO[];
  value: string;
  disabled?: boolean;
  hasError?: boolean;
  onSelect: (product: ProductDTO) => void;
}

function ProductPicker({
  products,
  value,
  disabled,
  hasError,
  onSelect,
}: ProductPickerProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = products.find((product) => product.id === value) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const query = search.trim().toLowerCase();
  const filtered =
    query === ""
      ? products
      : products.filter(
          (product) =>
            product.name.toLowerCase().includes(query) ||
            product.sku.toLowerCase().includes(query) ||
            product.modelNumber.toLowerCase().includes(query),
        );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className={cn(
          "flex w-full min-w-[180px] items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950",
          hasError
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-600"
            : "border-slate-300 focus:border-slate-400 focus:ring-slate-900/10 dark:border-slate-700 dark:focus:border-slate-600 dark:focus:ring-white/10",
        )}
      >
        {selected ? (
          <span className="truncate text-slate-900 dark:text-slate-100">
            {selected.name}
          </span>
        ) : (
          <span className="truncate text-slate-400 dark:text-slate-500">
            {t("order.form.items.selectProduct")}
          </span>
        )}
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-72 max-w-[80vw] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="relative border-b border-slate-100 p-2 dark:border-slate-800">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("order.form.items.searchProduct")}
              className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {t("order.form.items.noProducts")}
              </li>
            ) : (
              filtered.map((product) => {
                const isSelected = product.id === value;
                return (
                  <li key={product.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(product);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
                        isSelected && "bg-slate-50 dark:bg-slate-800/60",
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {product.name}
                        </span>
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {product.sku} · {product.modelNumber}
                        </span>
                      </span>
                      {isSelected && (
                        <Check
                          aria-hidden="true"
                          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

interface ProductLineEditorProps {
  lines: OrderLineRow[];
  products: ProductDTO[];
  /** Per-line computed totals keyed by row key (from the backend preview). */
  lineTotals: Record<string, string>;
  disabled?: boolean;
  /** Row keys that failed validation, highlighted for the user. */
  invalidKeys?: Set<string>;
  formatMoney: (value: string) => string;
  onProductSelect: (key: string, product: ProductDTO) => void;
  onQuantityChange: (key: string, value: string) => void;
  onUnitPriceChange: (key: string, value: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}

const cellInput =
  "w-full rounded-lg border bg-white px-3 py-2 text-right text-sm tabular-nums text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-slate-950 dark:text-slate-100";
const cellInputNormal =
  "border-slate-300 focus:border-slate-400 focus:ring-slate-900/10 dark:border-slate-700 dark:focus:border-slate-600 dark:focus:ring-white/10";
const cellInputError =
  "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-600";

export function ProductLineEditor({
  lines,
  products,
  lineTotals,
  disabled,
  invalidKeys,
  formatMoney,
  onProductSelect,
  onQuantityChange,
  onUnitPriceChange,
  onRemove,
  onAdd,
}: ProductLineEditorProps) {
  const { t } = useLanguage();
  const productsById = new Map(products.map((product) => [product.id, product]));

  return (
    <div className="space-y-3">
      {lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <Package aria-hidden="true" className="mb-2 size-5 text-slate-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("order.form.items.empty")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-800">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-left dark:border-slate-800 dark:bg-slate-900/60">
                <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("order.form.items.product")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("order.form.items.sku")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("order.form.items.category")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("order.form.items.quantity")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("order.form.items.unitPrice")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("order.form.items.lineTotal")}
                </th>
                <th scope="col" className="w-10 px-2 py-2.5">
                  <span className="sr-only">{t("order.form.items.remove")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((line) => {
                const product = productsById.get(line.productId) ?? null;
                const invalid = invalidKeys?.has(line.key) ?? false;
                const lineTotal = lineTotals[line.key];
                return (
                  <tr key={line.key} className="align-top">
                    <td className="px-3 py-2.5">
                      <ProductPicker
                        products={products}
                        value={line.productId}
                        disabled={disabled}
                        hasError={invalid && line.productId === ""}
                        onSelect={(selected) => onProductSelect(line.key, selected)}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {product?.sku ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-slate-600 dark:text-slate-300">
                        {product?.category?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={disabled}
                        aria-label={t("order.form.items.quantity")}
                        value={line.quantity}
                        onChange={(event) =>
                          onQuantityChange(line.key, sanitizeDecimal(event.target.value))
                        }
                        className={cn(
                          cellInput,
                          "max-w-[110px]",
                          invalid && (line.quantity === "" || Number(line.quantity) <= 0)
                            ? cellInputError
                            : cellInputNormal,
                        )}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-end gap-0.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          disabled={disabled}
                          aria-label={t("order.form.items.unitPrice")}
                          value={line.unitPrice}
                          onChange={(event) =>
                            onUnitPriceChange(line.key, sanitizeDecimal(event.target.value))
                          }
                          className={cn(cellInput, "max-w-[130px]", cellInputNormal)}
                        />
                        {product && line.priceTouched &&
                          line.unitPrice !== product.currentPrice && (
                            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              {t("order.form.items.priceOverridden")}
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle">
                      <span className="tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {lineTotal ? formatMoney(lineTotal) : "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center align-middle">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onRemove(line.key)}
                        aria-label={t("order.form.items.remove")}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Plus aria-hidden="true" className="size-4" />
        {t("order.form.items.addRow")}
      </button>
    </div>
  );
}
