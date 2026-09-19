import { PARSE_ERROR_CODE, type AuditResult, type Issue, type Severity } from "./types";
import { parseSvg } from "./svg";
import { runRules } from "./rules";

function countIssues(issues: Issue[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    counts[issue.severity] += 1;
  }
  return counts;
}

export function auditSvg(source: string, file = "image.svg"): AuditResult {
  const parsed = parseSvg(source);

  if (parsed.error !== null) {
    const issues: Issue[] = [
      {
        code: PARSE_ERROR_CODE,
        severity: "error",
        message: parsed.error,
        location: file,
        file,
      },
    ];
    return { file, issues, counts: countIssues(issues) };
  }

  let issues: Issue[] = [];
  try {
    issues = runRules(parsed, file);
  } catch {
    issues = [];
  }

  return { file, issues, counts: countIssues(issues) };
}
