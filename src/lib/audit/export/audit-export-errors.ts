import { AuditError } from "../audit-errors";

export class AuditExportError extends AuditError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "AuditExportError";
  }
}

export class AuditExportSizeLimitError extends AuditExportError {
  constructor(total: number, limit: number) {
    super(
      "EXPORT_SIZE_LIMIT",
      `Audit export exceeds maximum batch size (${total} > ${limit})`,
    );
    this.name = "AuditExportSizeLimitError";
    this.total = total;
    this.limit = limit;
  }

  readonly total: number;
  readonly limit: number;
}

export class AuditExportEmptyError extends AuditExportError {
  constructor() {
    super("EXPORT_EMPTY", "No audit records match the export filters");
    this.name = "AuditExportEmptyError";
  }
}
