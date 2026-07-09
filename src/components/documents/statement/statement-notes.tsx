"use client";

import { DocumentNotes } from "@/components/documents/sections/document-notes";
import type { StatementDocumentDTO, StatementDocumentLabels } from "@/components/documents/statement/statement-types";

interface StatementNotesProps {
  document: StatementDocumentDTO;
  labels: StatementDocumentLabels;
}

/** Ledger integrity and empty-state notes for the printable statement. */
export function StatementNotes({ document, labels }: StatementNotesProps) {
  const integrityText = document.ledgerIntegrityConsistent
    ? labels.integrityConsistentNote
    : labels.integrityWarningNote;

  const notesText =
    document.rows.length === 0
      ? `${labels.emptyStatementNote}\n${integrityText}`
      : integrityText;

  return <DocumentNotes title={labels.ledgerIntegrity} text={notesText} />;
}
