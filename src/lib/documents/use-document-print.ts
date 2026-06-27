"use client";

import { useCallback } from "react";

/**
 * Triggers browser print / Save-as-PDF for the shared `.document-print-root` DOM.
 * Print and PDF use the same vector HTML/CSS pipeline — no rasterization.
 */
export function useDocumentPrint() {
  const printDocument = useCallback(() => {
    window.print();
  }, []);

  /** Opens the browser print dialog — user selects "Save as PDF" for vector export. */
  const downloadPdf = useCallback(() => {
    window.print();
  }, []);

  return {
    printDocument,
    downloadPdf,
  };
}
