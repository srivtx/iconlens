export { auditSvg } from "./audit.ts";
export { formatJson, formatText } from "./report.ts";
export { parseSvg, accessibleName, nodeText, children } from "./svg.ts";
export type { ParsedSvg, NameSource } from "./svg.ts";
export { runRules } from "./rules.ts";
export { toSarif, writeSarif } from "./sarif.ts";
export { PARSE_ERROR_CODE } from "./types.ts";
export type { AuditResult, Issue, Severity } from "./types.ts";
