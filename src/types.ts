export type Severity = "error" | "warning" | "info";

export const PARSE_ERROR_CODE = "SVG-PARSE-000";

export interface Issue {
  code: string;
  severity: Severity;
  message: string;
  location: string;
  file?: string;
  wcag?: string;
}

export interface AuditResult {
  file: string;
  issues: Issue[];
  counts: Record<Severity, number>;
}
