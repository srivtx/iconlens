import { PARSE_ERROR_CODE, type AuditResult, type Issue, type Severity } from "./types";
import { parseSvg, type ParsedSvg } from "./svg";
import { runRules } from "./rules";

function countIssues(issues: Issue[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    counts[issue.severity] += 1;
  }
  return counts;
}

export type RuleRunner = (parsed: ParsedSvg, location: string) => Issue[];

export function auditFailure(file: string, message: string): AuditResult {
  const issues: Issue[] = [
    {
      code: PARSE_ERROR_CODE,
      severity: "error",
      message,
      location: file,
      file,
    },
  ];
  return { file, issues, counts: countIssues(issues) };
}

export function auditSvg(
  source: string,
  file = "image.svg",
  ruleRunner: RuleRunner = runRules,
): AuditResult {
  const parsed = parseSvg(source);

  if (parsed.error !== null) {
    return auditFailure(file, parsed.error);
  }

  let issues: Issue[];
  try {
    issues = ruleRunner(parsed, file);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return auditFailure(
      file,
      `Internal error while auditing: ${detail}. Input was not analysed; this is not a clean result.`,
    );
  }

  return { file, issues, counts: countIssues(issues) };
}
