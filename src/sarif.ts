import type { AuditResult, Issue, Severity } from "./types";

type SarifLevel = "error" | "warning" | "note";

export interface SarifRule {
  id: string;
}

export interface SarifPhysicalLocation {
  artifactLocation: { uri: string };
  region: { startLine: number };
}

export interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: { physicalLocation: SarifPhysicalLocation }[];
  properties: { tags: string[] };
}

export interface SarifLog {
  version: "2.1.0";
  $schema: string;
  runs: {
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
        rules: SarifRule[];
      };
    };
    results: SarifResult[];
  }[];
}

const INFORMATION_URI = "https://github.com/srivtx/iconlens";

function toLevel(severity: Severity): SarifLevel {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "note";
  }
}

function tagsFor(issue: Issue): string[] {
  const tags: string[] = [];
  if (issue.wcag !== undefined && issue.wcag.length > 0) {
    tags.push(`wcag-${issue.wcag}`);
  }
  tags.push(issue.severity);
  return tags;
}

function toResult(issue: Issue): SarifResult {
  return {
    ruleId: issue.code,
    level: toLevel(issue.severity),
    message: { text: issue.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: issue.file ?? issue.location },
          region: { startLine: 1 },
        },
      },
    ],
    properties: { tags: tagsFor(issue) },
  };
}

export function toSarif(
  results: AuditResult | AuditResult[],
  toolName: string,
  toolVersion: string,
): SarifLog {
  const list = Array.isArray(results) ? results : [results];

  const codes = new Set<string>();
  const sarifResults: SarifResult[] = [];
  for (const result of list) {
    for (const issue of result.issues ?? []) {
      codes.add(issue.code);
      sarifResults.push(toResult(issue));
    }
  }

  const rules: SarifRule[] = [...codes].sort().map((id) => ({ id }));

  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            version: toolVersion,
            informationUri: INFORMATION_URI,
            rules,
          },
        },
        results: sarifResults,
      },
    ],
  };
}

export async function writeSarif(
  path: string,
  results: AuditResult | AuditResult[],
  toolName: string,
  toolVersion: string,
): Promise<number> {
  const sarif = toSarif(results, toolName, toolVersion);
  return Bun.write(path, `${JSON.stringify(sarif, null, 2)}\n`);
}
