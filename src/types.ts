export type Severity = "error" | "warning" | "info";

export interface Issue {
  code: string;
  severity: Severity;
  message: string;
  location: string;
  wcag?: string;
}

export interface AuditResult {
  file: string;
  issues: Issue[];
  counts: Record<Severity, number>;
}
