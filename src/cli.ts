#!/usr/bin/env bun
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditSvg } from "./audit.ts";
import { formatJson, formatText } from "./report.ts";
import { writeSarif } from "./sarif.ts";
import type { AuditResult, Severity } from "./types.ts";

export type FailOn = "error" | "warning" | "info" | "none";

interface Options {
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

const USAGE = `iconlens - offline accessibility linter for standalone SVG files

Usage:
  iconlens <file...> [--json] [--quiet] [--sarif <path>] [--fail-on <level>]
  iconlens --dir <path> [--json] [--quiet] [--sarif <path>] [--fail-on <level>]

Options:
  --dir <path>            Lint every .svg file in <path> (non-recursive, sorted)
  --json                  Print machine-readable JSON instead of text
  --quiet                 Print a single summary line per file
  --sarif <path>          Write a SARIF 2.1.0 report to <path>
  --fail-on <level>       Exit non-zero at this severity or above:
                          error (default), warning, info, none
  -h, --help              Show this help
  -v, --version           Print the version

Exit codes:
  0  no issues at or above --fail-on
  1  at least one issue at or above --fail-on
  2  invalid usage / no input
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
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--quiet") {
      opts.quiet = true;
    } else if (arg === "--dir") {
      const next = argv[++i];
      if (next === undefined) {
        throw new Error("--dir requires a path argument");
      }
      opts.dir = next;
    } else if (arg === "--sarif") {
      const next = argv[++i];
      if (next === undefined) {
        throw new Error("--sarif requires a path argument");
      }
      opts.sarif = next;
    } else if (arg === "--fail-on") {
      const next = argv[++i];
      if (next === undefined) {
        throw new Error("--fail-on requires a level argument");
      }
      if (!FAIL_ON_VALUES.includes(next as FailOn)) {
        throw new Error(`Invalid --fail-on value: ${next} (expected error, warning, info, or none)`);
      }
      opts.failOn = next as FailOn;
    } else if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg === "-v" || arg === "--version") {
      opts.version = true;
    } else if (arg !== undefined && arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (arg !== undefined) {
      opts.files.push(arg);
    }
  }
  return opts;
}

function collectFiles(opts: Options): string[] {
  const files = [...opts.files];
  if (opts.dir !== null) {
    const entries = readdirSync(opts.dir)
      .filter((name) => name.toLowerCase().endsWith(".svg"))
      .sort();
    for (const name of entries) {
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

export async function run(argv: string[]): Promise<number> {
  let opts: Options;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
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

  const files = collectFiles(opts);
  if (files.length === 0) {
    console.error(USAGE);
    return 2;
  }

  let failed = false;
  const results: AuditResult[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = await Bun.file(file).text();
    } catch (err) {
      console.error(`${file}: ${err instanceof Error ? err.message : String(err)}`);
      failed = true;
      continue;
    }
    const result = auditSvg(text, basename(file));
    results.push(result);
    if (exceedsFailOn(result.counts, opts.failOn)) {
      failed = true;
    }
    if (opts.quiet) {
      console.log(
        `${basename(file)}: ${result.counts.error} error(s), ${result.counts.warning} warning(s), ${result.counts.info} info`,
      );
    } else if (opts.json) {
      console.log(formatJson(result));
    } else {
      console.log(formatText(result));
    }
  }

  if (opts.sarif !== null) {
    await writeSarif(opts.sarif, results, "iconlens", VERSION);
  }

  return failed ? 1 : 0;
}

if (import.meta.main) {
  const code = await run(process.argv.slice(2));
  process.exit(code);
}
