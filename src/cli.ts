#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditFailure, auditSvg } from "./audit.ts";
import { formatJson, formatText } from "./report.ts";
import { writeSarif } from "./sarif.ts";
import { PARSE_ERROR_CODE, type AuditResult, type Severity } from "./types.ts";

export type FailOn = "error" | "warning" | "info" | "none";

export interface Options {
  json: boolean;
  quiet: boolean;
  dir: string | null;
  help: boolean;
  version: boolean;
  sarif: string | null;
  failOn: FailOn;
  files: string[];
}

const FAIL_ON_VALUES: FailOn[] = ["error", "warning", "info", "none"];

function readVersion(): string {
  try {
    const pkgUrl = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(fileURLToPath(pkgUrl), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = readVersion();

export const MAX_INPUT_BYTES = 16 * 1024 * 1024;

export function oversizeMessage(size: number): string {
  return `Input is ${size} bytes, which exceeds the ${MAX_INPUT_BYTES}-byte (16 MiB) limit; input was not parsed.`;
}

const USAGE = `iconlens - offline accessibility linter for standalone SVG files

Usage:
  iconlens <file...> [--json] [--quiet] [--sarif <path>] [--fail-on <level>]
  iconlens --dir <path> [--json] [--quiet] [--sarif <path>] [--fail-on <level>]

Options:
  --dir <path>            Lint every .svg file in <path> (non-recursive, sorted)
  --json                  Print machine-readable JSON; one object for a single
                          file, a JSON array when linting more than one
  --quiet, -q             Print a single summary line per file
  --sarif <path>          Write a SARIF 2.1.0 report to <path>
  --fail-on <level>       Exit non-zero at this severity or above:
                          error (default), warning, info, none
  -h, --help              Show this help
  -v, --version           Print the version
  --                      End of options; treat the remaining arguments as files
                          (use this to lint a file whose name starts with "-")

Reads standard input when a <file> is "-" (reported as <stdin>).

Input size:
  Inputs larger than ${MAX_INPUT_BYTES} bytes (16 MiB) are rejected with an
  SVG-PARSE-000 error, for both files and standard input.

Exit codes:
  0  no issues at or above --fail-on
  1  at least one issue at or above --fail-on
  2  invalid usage, input over the size limit, or input that is not a
     well-formed SVG document
  3  I/O error (an input file could not be read, or the report could not be
     written)
`;

export function parseArgs(argv: string[]): Options {
  const opts: Options = {
    json: false,
    quiet: false,
    dir: null,
    help: false,
    version: false,
    sarif: null,
    failOn: "error",
    files: [],
  };
  let endOfOptions = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (endOfOptions) {
      opts.files.push(arg);
      continue;
    }
    if (arg === "--") {
      endOfOptions = true;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--quiet" || arg === "-q") {
      opts.quiet = true;
    } else if (arg === "--dir" || arg.startsWith("--dir=")) {
      const value = arg.startsWith("--dir=") ? arg.slice("--dir=".length) : argv[++i];
      if (value === undefined || value.length === 0 || value.startsWith("-")) {
        throw new Error("--dir requires a path argument");
      }
      opts.dir = value;
    } else if (arg === "--sarif" || arg.startsWith("--sarif=")) {
      const value = arg.startsWith("--sarif=") ? arg.slice("--sarif=".length) : argv[++i];
      if (value === undefined || value.length === 0 || value.startsWith("-")) {
        throw new Error("--sarif requires a path argument");
      }
      opts.sarif = value;
    } else if (arg === "--fail-on" || arg.startsWith("--fail-on=")) {
      const value = arg.startsWith("--fail-on=") ? arg.slice("--fail-on=".length) : argv[++i];
      if (value === undefined || value.length === 0) {
        throw new Error("--fail-on requires a level argument");
      }
      if (!FAIL_ON_VALUES.includes(value as FailOn)) {
        throw new Error(`Invalid --fail-on value: ${value} (expected error, warning, info, or none)`);
      }
      opts.failOn = value as FailOn;
    } else if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg === "-v" || arg === "--version") {
      opts.version = true;
    } else if (arg === "-") {
      opts.files.push(arg);
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option ${arg}`);
    } else {
      opts.files.push(arg);
    }
  }
  return opts;
}

function collectFiles(opts: Options): string[] {
  const files = [...opts.files];
  if (opts.dir !== null) {
    let entries: string[];
    try {
      entries = readdirSync(opts.dir);
    } catch (err) {
      throw new Error(
        `cannot read --dir "${opts.dir}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const svgs = entries.filter((name) => name.toLowerCase().endsWith(".svg")).sort();
    for (const name of svgs) {
      files.push(join(opts.dir, name));
    }
  }
  return files;
}

function exceedsFailOn(counts: Record<Severity, number>, failOn: FailOn): boolean {
  switch (failOn) {
    case "none":
      return false;
    case "info":
      return counts.error > 0 || counts.warning > 0 || counts.info > 0;
    case "warning":
      return counts.error > 0 || counts.warning > 0;
    case "error":
      return counts.error > 0;
  }
}

async function readStdinCapped(maxBytes: number): Promise<{ text: string; size: number }> {
  const reader = Bun.stdin.stream().getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        chunks.length = 0;
        try {
          await reader.cancel();
        } catch {
          void 0;
        }
        return { text: "", size: total };
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      void 0;
    }
  }
  return { text: Buffer.concat(chunks, total).toString("utf8"), size: total };
}

export async function run(argv: string[]): Promise<number> {
  let opts: Options;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(`iconlens: ${err instanceof Error ? err.message : String(err)}`);
    console.error(USAGE);
    return 2;
  }

  if (opts.help) {
    console.log(USAGE);
    return 0;
  }

  if (opts.version) {
    console.log(VERSION);
    return 0;
  }

  let files: string[];
  try {
    files = collectFiles(opts);
  } catch (err) {
    console.error(`iconlens: ${err instanceof Error ? err.message : String(err)}`);
    return 3;
  }

  if (files.length === 0) {
    if (opts.dir !== null) {
      console.error(`iconlens: no .svg files found in "${opts.dir}"`);
    } else {
      console.error("iconlens: no input files");
    }
    console.error(USAGE);
    return 2;
  }

  let failed = false;
  let parseFailure = false;
  let ioFailure = false;
  const results: AuditResult[] = [];

  for (const file of files) {
    const displayName = file === "-" ? "<stdin>" : basename(file);
    let text: string | undefined;
    let result: AuditResult | undefined;

    if (file === "-") {
      try {
        const stdin = await readStdinCapped(MAX_INPUT_BYTES);
        if (stdin.size > MAX_INPUT_BYTES) {
          result = auditFailure(displayName, oversizeMessage(stdin.size));
        } else {
          text = stdin.text;
        }
      } catch (err) {
        console.error(
          `iconlens: cannot read <stdin>: ${err instanceof Error ? err.message : String(err)}`,
        );
        ioFailure = true;
        continue;
      }
    } else {
      let size: number;
      try {
        size = statSync(file).size;
      } catch (err) {
        console.error(
          `iconlens: cannot read ${file}: ${err instanceof Error ? err.message : String(err)}`,
        );
        ioFailure = true;
        continue;
      }
      if (size > MAX_INPUT_BYTES) {
        result = auditFailure(displayName, oversizeMessage(size));
      } else {
        try {
          text = await Bun.file(file).text();
        } catch (err) {
          console.error(
            `iconlens: cannot read ${file}: ${err instanceof Error ? err.message : String(err)}`,
          );
          ioFailure = true;
          continue;
        }
        const bytes = Buffer.byteLength(text, "utf8");
        if (bytes > MAX_INPUT_BYTES) {
          text = undefined;
          result = auditFailure(displayName, oversizeMessage(bytes));
        }
      }
    }

    if (result === undefined) {
      result = auditSvg(text ?? "", displayName);
    }

    results.push(result);
    if (result.issues.some((issue) => issue.code === PARSE_ERROR_CODE)) {
      parseFailure = true;
    }
    if (exceedsFailOn(result.counts, opts.failOn)) {
      failed = true;
    }

    if (opts.json) {
      continue;
    }
    if (opts.quiet) {
      console.log(
        `${displayName}: ${result.counts.error} error(s), ${result.counts.warning} warning(s), ${result.counts.info} info`,
      );
    } else {
      console.log(formatText(result));
    }
  }

  if (opts.json && results.length > 0) {
    console.log(results.length === 1 ? formatJson(results[0]!) : JSON.stringify(results, null, 2));
  }

  if (opts.sarif !== null) {
    try {
      await writeSarif(opts.sarif, results, "iconlens", VERSION);
    } catch (err) {
      console.error(
        `iconlens: cannot write SARIF report to ${opts.sarif}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 3;
    }
  }

  if (parseFailure) return 2;
  if (ioFailure) return 3;
  return failed ? 1 : 0;
}

if (import.meta.main) {
  const code = await run(process.argv.slice(2));
  process.exit(code);
}
